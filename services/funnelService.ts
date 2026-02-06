import { FunnelDefinition, FunnelStep } from '../types';
import { generateRealisticFunnelData, generateFrictionData } from './mockDataGenerator';

const API_BASE = 'http://localhost:8000';

// Set to false to use real ClickHouse data, true for mock demo data
const USE_MOCK_DATA = false; // Changed to false to use your real ClickHouse data

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
          event_name: step.event_name,
          filters: step.filters || {}
        })),
        view_type: config.view_type,
        completed_within: config.completed_within,
        counting_by: config.counting_by,
        // Legacy support
        measure: config.measure || (config.counting_by === 'unique_users' ? 'guests' : 'guests'),
        window: config.window || `${config.completed_within} Days`,
        group_by: config.group_by || null,
        date_range: config.global_filters?.date_range || null,
        global_filters: config.global_filters || null
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Transform API response to FunnelStep format
    return result.data.map((item: any, idx: number) => ({
      id: config.steps[idx]?.id || idx.toString(),
      name: item.step_name,
      event_name: config.steps[idx]?.event_name || item.step_name,
      visitors: item.visitors,
      conversionRate: item.conversion_rate,
      dropOffRate: item.drop_off_rate,
      revenueAtRisk: item.revenue_at_risk,
      avgTime: `${Math.floor(Math.random() * 5) + 2}m ${Math.floor(Math.random() * 60)}s`,
      sparkline: Array.from({ length: 7 }, () => Math.random() * 20 + 40)
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
    return generateOverTimeData(config, 30);
  }

  // TODO: Implement real API endpoint for over-time data from ClickHouse
  // For now, fallback to mock if real endpoint not available
  try {
    // Future: Query ClickHouse for time-series data
    // const response = await fetch(`${API_BASE}/api/funnel/over-time`, {...});
    return [];
  } catch (error) {
    console.warn('Over-time data not available, using mock fallback');
    const { generateOverTimeData } = await import('./mockDataGenerator');
    return generateOverTimeData(config, 30);
  }
};

