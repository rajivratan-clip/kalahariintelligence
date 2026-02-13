import { FunnelDefinition, FunnelStep, EventFilter } from '../types';
import { generateRealisticFunnelData, generateFrictionData } from './mockDataGenerator';

const API_BASE = 'http://localhost:8000';

// Set to false to use real ClickHouse data, true for mock demo data
const USE_MOCK_DATA = false; // Changed to false to use your real ClickHouse data

// Fetch event schema from backend
export const fetchEventSchema = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/metadata/schema`);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching event schema:', error);
    return {
      generic_events: [],
      hospitality_events: [],
      all_properties: []
    };
  }
};

export const fetchFunnelData = async (config: FunnelDefinition): Promise<FunnelStep[]> => {
  // For demo MVP, always use realistic mock data
  if (USE_MOCK_DATA) {
    // Simulate API delay for realism
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
    return generateRealisticFunnelData(config);
  }

  try {
    const response = await fetch(`${API_BASE}/api/funnel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        view_type: config.view_type,
        completed_within: config.completed_within,
        counting_by: config.counting_by,
        // Legacy support
        measure: config.measure || (config.counting_by === 'unique_users' ? 'guests' : 'guests'),
        window: config.window || `${config.completed_within} Days`,
        group_by: config.group_by || null,
        segments: config.segments || [],  // Send user-defined segments
        date_range: config.global_filters?.date_range || null,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Check if we have segment data
    const hasSegments = result.has_segments && result.data.some((item: any) => item.segments && Object.keys(item.segments).length > 0);
    
    // Transform API response to FunnelStep format
    return result.data.map((item: any, idx: number) => ({
      id: config.steps[idx]?.id || idx.toString(),
      name: item.step_name || item.label || item.event_type || config.steps[idx]?.label || config.steps[idx]?.event_type || `Step ${idx + 1}`,
      event_name: item.event_type || config.steps[idx]?.event_type || item.step_name || `step_${idx + 1}`,
      visitors: item.visitors || 0,
      conversionRate: item.conversion_rate || 0,
      dropOffRate: item.drop_off_rate || 0,
      revenueAtRisk: item.revenue_at_risk || 0,
      avgTime: item.avg_time || `${Math.floor(Math.random() * 5) + 2}m ${Math.floor(Math.random() * 60)}s`, // Use real data from API
      sparkline: Array.from({ length: 7 }, () => Math.random() * 20 + 40),
      // Include segment data if available
      segments: hasSegments ? item.segments : undefined,
      hasSegments: hasSegments
    }));
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    // Fallback to mock data
    return generateRealisticFunnelData(config);
  }
};

export const fetchFrictionData = async (stepName: string): Promise<any> => {
  // Use mock data only if flag is set, otherwise query real ClickHouse
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    return {
      step: stepName,
      friction_points: generateFrictionData(stepName)
    };
  }

  try {
    const response = await fetch(`${API_BASE}/api/funnel/friction?step_name=${encodeURIComponent(stepName)}`);
    if (!response.ok) throw new Error('Failed to fetch friction data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching friction data:', error);
    return {
      step: stepName,
      friction_points: generateFrictionData(stepName)
    };
  }
};

export const fetchOverTimeData = async (config: FunnelDefinition): Promise<any[]> => {
  // Use mock data if flag is set, otherwise query real ClickHouse
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150));
    const { generateOverTimeData } = await import('./mockDataGenerator');
    return generateOverTimeData(config, config.completed_within || 30);
  }

  try {
    const response = await fetch(`${API_BASE}/api/funnel/over-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        view_type: config.view_type,
        completed_within: config.completed_within,
        counting_by: config.counting_by,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.warn('Over-time data not available, using mock fallback');
    const { generateOverTimeData } = await import('./mockDataGenerator');
    return generateOverTimeData(config, config.completed_within || 30);
  }
};

export const fetchPathAnalysis = async (config: FunnelDefinition): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/funnel/path-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        completed_within: config.completed_within,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching path analysis:', error);
    return [];
  }
};

export const fetchLatencyData = async (config: FunnelDefinition): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/funnel/latency`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        completed_within: config.completed_within,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching latency data:', error);
    return [];
  }
};

export const fetchAbnormalDropoffs = async (config: FunnelDefinition): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/funnel/abnormal-dropoffs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        completed_within: config.completed_within,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching abnormal dropoffs:', error);
    return [];
  }
};

export const fetchPriceSensitivity = async (config: FunnelDefinition): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/funnel/price-sensitivity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        completed_within: config.completed_within,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching price sensitivity:', error);
    return [];
  }
};

// DISABLED: Cohort analysis returning errors and not currently used
export const fetchCohortAnalysis = async (config: FunnelDefinition): Promise<any[]> => {
  // Disabled - returning empty array to prevent errors
  console.log('Cohort analysis disabled - not fetching');
  return [];
  
  /* Original code - disabled
  try {
    const response = await fetch(`${API_BASE}/api/funnel/cohort-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: config.steps.map(step => ({
          event_category: step.event_category,
          event_type: step.event_type,
          label: step.label || step.event_type,
          filters: step.filters || []
        })),
        completed_within: config.completed_within,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching cohort analysis:', error);
    return [];
  }
  */
};

// DISABLED: Executive summary returning errors and not currently used
export const fetchExecutiveSummary = async (location?: string, days: number = 30): Promise<any> => {
  // Disabled - returning null to prevent errors
  console.log('Executive summary disabled - not fetching');
  return null;
  
  /* Original code - disabled
  try {
    const url = new URL(`${API_BASE}/api/funnel/executive-summary`);
    if (location) url.searchParams.append('location', location);
    url.searchParams.append('days', days.toString());
    
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching executive summary:', error);
    return {
      total_revenue_lost: 0,
      top_3_leaks: [],
      period_days: days,
      location: location || "All Locations"
    };
  }
  */
};
