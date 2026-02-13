/**
 * Autonomous Builder Service
 * Complete end-to-end: NL Query → Config → Database Query → Chart Rendering
 * Handles the full flow from natural language to rendered chart.
 */

import type { FunnelDefinition, FunnelStepConfig, SegmentComparison, EventFilter } from '../types';
import { fetchFunnelData } from './funnelService';

export interface AutonomousBuildRequest {
  query: string;
  currentConfig?: FunnelDefinition | null;
}

export interface AutonomousBuildResult {
  config: FunnelDefinition;
  data: any[]; // Funnel data from database
  explanation: string;
  confidence: number;
  extractedParams: {
    steps?: string[];
    viewType?: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance';
    segmentComparisons?: Array<{ dimension: string; value: string }>;
    countingBy?: 'unique_users' | 'sessions' | 'events';
    completedWithin?: number;
    dateRange?: { start: string; end: string };
  };
}

/**
 * Complete autonomous builder: Query → Config → Data → Chart
 */
export async function buildChartFromQuery(
  request: AutonomousBuildRequest
): Promise<AutonomousBuildResult> {
  // Step 1: Parse NL query and extract all parameters
  const parsed = await parseQueryToConfig(request.query, request.currentConfig);

  // Step 2: Build complete FunnelDefinition
  const config = buildFunnelDefinition(parsed);

  // Step 3: Query database with the config
  const data = await fetchFunnelData(config);

  return {
    config,
    data,
    explanation: parsed.explanation,
    confidence: parsed.confidence,
    extractedParams: parsed.extractedParams,
  };
}

/**
 * Parse natural language query to extract all parameters
 */
async function parseQueryToConfig(
  query: string,
  currentConfig?: FunnelDefinition | null
): Promise<{
  steps: FunnelStepConfig[];
  viewType: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance';
  segmentComparisons?: Array<{ dimension: string; value: string }>;
  countingBy: 'unique_users' | 'sessions' | 'events';
  completedWithin: number;
  groupBy?: 'device_type' | 'guest_segment' | 'traffic_source' | null;
  dateRange?: { start: string; end: string };
  explanation: string;
  confidence: number;
  extractedParams: AutonomousBuildResult['extractedParams'];
}> {
  try {
    const response = await fetch('http://localhost:8000/api/ai/parse-funnel-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        current_config: currentConfig,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse query');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error parsing query:', error);
    // Fallback to rule-based parsing
    return parseQueryFallback(query);
  }
}

/**
 * Build complete FunnelDefinition from parsed parameters
 */
function buildFunnelDefinition(parsed: any): FunnelDefinition {
  // Map step names to FunnelStepConfig
  const steps: FunnelStepConfig[] = parsed.steps.map((stepName: string, idx: number) => {
    const stepMapping: Record<string, { event_type: string; event_category: 'generic' | 'hospitality' }> = {
      'landed': { event_type: 'Landed', event_category: 'hospitality' },
      'location select': { event_type: 'Location Select', event_category: 'hospitality' },
      'location': { event_type: 'Location Select', event_category: 'hospitality' },
      'date select': { event_type: 'Date Select', event_category: 'hospitality' },
      'date': { event_type: 'Date Select', event_category: 'hospitality' },
      'room select': { event_type: 'Room Select', event_category: 'hospitality' },
      'room': { event_type: 'Room Select', event_category: 'hospitality' },
      'payment': { event_type: 'Payment', event_category: 'hospitality' },
      'pay': { event_type: 'Payment', event_category: 'hospitality' },
      'confirmation': { event_type: 'Confirmation', event_category: 'hospitality' },
      'confirm': { event_type: 'Confirmation', event_category: 'hospitality' },
    };

    const normalized = stepName.toLowerCase().trim();
    const mapping = stepMapping[normalized] || {
      event_type: stepName,
      event_category: 'generic' as const,
    };

    return {
      id: (idx + 1).toString(),
      label: stepName,
      event_type: mapping.event_type,
      event_category: mapping.event_category,
    };
  });

  // Build segment comparisons (handle multiple segments)
  let segments: SegmentComparison[] | undefined;
  let groupBy: 'device_type' | 'guest_segment' | 'traffic_source' | null = null;
  
  if (parsed.segmentComparisons && Array.isArray(parsed.segmentComparisons) && parsed.segmentComparisons.length > 0) {
    // Multiple segments for comparison
    segments = parsed.segmentComparisons.map((seg: any, idx: number) => {
      const filters: EventFilter[] = [
        {
          property: seg.dimension,
          operator: 'equals',
          value: seg.value,
        },
      ];

      return {
        id: `segment-${idx + 1}`,
        name: `${seg.dimension} = ${seg.value}`,
        filters,
      };
    });

    // Set group_by based on first segment's dimension
    const firstDim = parsed.segmentComparisons[0].dimension;
    if (firstDim === 'device_type' || firstDim === 'guest_segment' || firstDim === 'traffic_source') {
      groupBy = firstDim;
    }
  } else if (parsed.segmentComparison) {
    // Single segment (backward compatibility)
    const { dimension, value } = parsed.segmentComparison;
    const filters: EventFilter[] = [
      {
        property: dimension,
        operator: 'equals',
        value: value,
      },
    ];

    segments = [
      {
        id: 'segment-1',
        name: `${dimension} = ${value}`,
        filters,
      },
    ];

    if (dimension === 'device_type' || dimension === 'guest_segment' || dimension === 'traffic_source') {
      groupBy = dimension;
    }
  }

  // Extract view type (measured as)
  const viewType = parsed.viewType || parsed.view_type || 'conversion';
  const validViewTypes: Array<FunnelDefinition['view_type']> = ['conversion', 'overTime', 'timeToConvert', 'frequency', 'improvement', 'significance'];
  const finalViewType = validViewTypes.includes(viewType) ? viewType : 'conversion';

  return {
    steps,
    view_type: finalViewType,
    completed_within: parsed.completedWithin || parsed.completed_within || 30,
    counting_by: parsed.countingBy || parsed.counting_by || 'unique_users',
    order: 'strict',
    group_by: groupBy,
    segments,
    global_filters: parsed.dateRange
      ? {
          date_range: parsed.dateRange,
        }
      : undefined,
  };
}

/**
 * Fallback rule-based parser (when AI is unavailable)
 */
function parseQueryFallback(query: string): any {
  const lower = query.toLowerCase();

  // Extract steps
  const stepKeywords = [
    'landed',
    'location select',
    'location',
    'date select',
    'date',
    'room select',
    'room',
    'payment',
    'confirmation',
  ];

  const steps: string[] = [];
  for (const keyword of stepKeywords) {
    if (lower.includes(keyword)) {
      steps.push(keyword);
    }
  }

  // Default steps if none found
  if (steps.length === 0) {
    steps.push('landed', 'location select', 'date select', 'room select', 'payment', 'confirmation');
  }

  // Extract counting method
  let countingBy: 'unique_users' | 'sessions' | 'events' = 'unique_users';
  if (lower.includes('unique user') || lower.includes('unique users')) {
    countingBy = 'unique_users';
  } else if (lower.includes('session')) {
    countingBy = 'sessions';
  } else if (lower.includes('event')) {
    countingBy = 'events';
  }

  // Extract completed within
  let completedWithin = 30;
  const dayMatch = lower.match(/(\d+)\s*day/i);
  if (dayMatch) {
    completedWithin = parseInt(dayMatch[1], 10);
  }

  // Extract view type
  let viewType: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance' = 'conversion';
  if (lower.includes('over time') || lower.includes('overtime')) {
    viewType = 'overTime';
  } else if (lower.includes('time to convert') || lower.includes('duration')) {
    viewType = 'timeToConvert';
  } else if (lower.includes('frequency')) {
    viewType = 'frequency';
  } else if (lower.includes('improvement')) {
    viewType = 'improvement';
  } else if (lower.includes('significance')) {
    viewType = 'significance';
  }

  // Extract segment comparisons (handle "vs", "versus")
  let segmentComparisons: Array<{ dimension: string; value: string }> | undefined;
  if (lower.includes('vs') || lower.includes('versus')) {
    const segmentsList: Array<{ dimension: string; value: string }> = [];
    if (lower.includes('mobile') && lower.includes('tablet')) {
      segmentsList.push(
        { dimension: 'device_type', value: 'mobile' },
        { dimension: 'device_type', value: 'tablet' }
      );
    } else if (lower.includes('mobile') && lower.includes('desktop')) {
      segmentsList.push(
        { dimension: 'device_type', value: 'mobile' },
        { dimension: 'device_type', value: 'desktop' }
      );
    } else if (lower.includes('mobile') && lower.includes('device')) {
      segmentsList.push({ dimension: 'device_type', value: 'mobile' });
    } else if (lower.includes('tablet') && lower.includes('device')) {
      segmentsList.push({ dimension: 'device_type', value: 'tablet' });
    }
    segmentComparisons = segmentsList.length > 0 ? segmentsList : undefined;
  } else if (lower.includes('mobile') && lower.includes('device')) {
    segmentComparisons = [{ dimension: 'device_type', value: 'mobile' }];
  } else if (lower.includes('tablet') && lower.includes('device')) {
    segmentComparisons = [{ dimension: 'device_type', value: 'tablet' }];
  } else if (lower.includes('desktop') && lower.includes('device')) {
    segmentComparisons = [{ dimension: 'device_type', value: 'desktop' }];
  }

  return {
    steps,
    viewType,
    segmentComparisons,
    countingBy,
    completedWithin,
    explanation: `Built ${viewType} funnel with ${steps.length} steps`,
    confidence: 75,
    extractedParams: {
      steps,
      viewType,
      segmentComparisons,
      countingBy,
      completedWithin,
    },
  };
}
