import { FunnelDefinition, FunnelStep } from '../types';

// Realistic conversion rates per step (hospitality industry benchmarks)
const REALISTIC_CONVERSION_RATES: Record<string, number> = {
  'landed': 1.0,              // 100% - everyone who lands
  'location_select': 0.72,    // 72% - most people pick a location
  'date_select': 0.58,        // 58% - calendar interaction
  'room_select': 0.42,        // 42% - browsing rooms
  'addon_select': 0.28,       // 28% - looking at extras
  'guest_info': 0.18,         // 18% - entering details
  'payment': 0.12,            // 12% - payment screen
  'confirmation': 0.08,        // 8% - final conversion
  'session_start': 1.0,
  'page_view': 0.95,
  'form_interaction': 0.35,
  'click': 0.65,
};

// Average booking values by location (for revenue calculations)
const ABV_BY_LOCATION: Record<string, number> = {
  'Wisconsin': 285,
  'Pocono': 320,
  'Sandusky': 245,
  'Round Rock': 195,
  'All Locations': 260,
};

// Device distribution
const DEVICE_DISTRIBUTION = {
  mobile: 0.68,
  desktop: 0.28,
  tablet: 0.04,
};

// Guest segment distribution
const SEGMENT_DISTRIBUTION = {
  'Family': 0.45,
  'Couple': 0.32,
  'Business': 0.15,
  'Luxury': 0.08,
};

// Friction points by step
const FRICTION_BY_STEP: Record<string, Array<{element: string; failure_rate: number}>> = {
  'location_select': [
    { element: 'Location Map Load', failure_rate: 0.35 },
    { element: 'Resort Image Gallery', failure_rate: 0.22 },
  ],
  'date_select': [
    { element: 'Calendar Date Picker', failure_rate: 0.48 },
    { element: 'Availability Check', failure_rate: 0.31 },
  ],
  'room_select': [
    { element: 'Room Image Zoom', failure_rate: 0.42 },
    { element: 'Price Comparison Tool', failure_rate: 0.28 },
  ],
  'payment': [
    { element: 'Promo Code Input', failure_rate: 0.68 },
    { element: 'Credit Card Form', failure_rate: 0.52 },
    { element: 'Payment Gateway', failure_rate: 0.41 },
  ],
  'guest_info': [
    { element: 'Guest Details Form', failure_rate: 0.38 },
    { element: 'Email Validation', failure_rate: 0.25 },
  ],
};

export const generateRealisticFunnelData = (
  config: FunnelDefinition,
  seed?: number
): FunnelStep[] => {
  // Use seed for consistency, but add some variation based on config
  const baseSeed = seed || Date.now();
  const rng = (multiplier: number) => {
    const val = Math.sin(baseSeed * multiplier) * 10000;
    return val - Math.floor(val);
  };

  // Adjust base visitors based on location filter
  const location = config.global_filters?.location || 'All Locations';
  const locationMultiplier = location === 'Wisconsin' ? 1.2 : location === 'Pocono' ? 0.9 : 1.0;
  const baseVisitors = Math.floor(12500 * locationMultiplier * (0.9 + rng(1) * 0.2));

  // Adjust conversion rates based on measure type
  const measureMultiplier = config.measure === 'revenue' ? 0.95 : config.measure === 'intent' ? 1.05 : 1.0;

  let currentVisitors = baseVisitors;
  const steps: FunnelStep[] = [];

  config.steps.forEach((step, idx) => {
    // Get realistic conversion rate for this step
    const baseRate = REALISTIC_CONVERSION_RATES[step.event_name] || 0.5;
    const adjustedRate = baseRate * measureMultiplier * (0.95 + rng(idx + 1) * 0.1);
    
    // Calculate visitors for this step
    const visitors = idx === 0 
      ? currentVisitors 
      : Math.floor(currentVisitors * adjustedRate);
    
    // Calculate drop-off and conversion
    const prevVisitors = idx === 0 ? visitors : steps[idx - 1].visitors;
    const conversionRate = idx === 0 ? 100 : (visitors / prevVisitors) * 100;
    const dropOffRate = idx === 0 ? 0 : 100 - conversionRate;
    
    // Calculate revenue at risk (only if dropping off)
    const droppedSessions = Math.max(0, prevVisitors - visitors);
    const abv = ABV_BY_LOCATION[location] || 260;
    const revenueAtRisk = idx === 0 ? 0 : droppedSessions * abv;

    // Generate sparkline (conversion trend over last 7 days)
    const sparkline = Array.from({ length: 7 }, (_, i) => {
      const dayVariation = 0.85 + rng(idx * 10 + i) * 0.3;
      return Math.max(0, Math.min(100, conversionRate * dayVariation));
    });

    // Calculate average time (realistic progression)
    const baseMinutes = 2 + idx * 1.5;
    const baseSeconds = 15 + idx * 8;
    const avgTime = `${Math.floor(baseMinutes)}m ${baseSeconds}s`;

    // Get friction points for this step
    const frictionPoints = FRICTION_BY_STEP[step.event_name] || [];
    const topFriction = frictionPoints[0]?.element || undefined;

    steps.push({
      id: step.id,
      name: step.name,
      event_name: step.event_name,
      visitors,
      conversionRate: Math.round(conversionRate * 10) / 10,
      dropOffRate: Math.round(dropOffRate * 10) / 10,
      revenueAtRisk: Math.round(revenueAtRisk),
      avgTime,
      topFriction,
      frictionPoints: frictionPoints.map(fp => ({
        element: fp.element,
        clicks: Math.floor(visitors * (0.3 + rng(idx) * 0.4)),
        failures: 0,
        failure_rate: fp.failure_rate * 100,
      })).map(fp => ({
        ...fp,
        failures: Math.floor(fp.clicks * (fp.failure_rate / 100)),
      })),
      sparkline,
    });

    currentVisitors = visitors;
  });

  return steps;
};

export const generateSegmentedData = (
  baseData: FunnelStep[],
  groupBy: 'device_type' | 'guest_segment' | null
): Record<string, FunnelStep[]> => {
  if (!groupBy) {
    return { all: baseData };
  }

  const segments = groupBy === 'device_type' 
    ? Object.keys(DEVICE_DISTRIBUTION)
    : Object.keys(SEGMENT_DISTRIBUTION);

  const result: Record<string, FunnelStep[]> = {};

  segments.forEach(segment => {
    const multiplier = groupBy === 'device_type'
      ? DEVICE_DISTRIBUTION[segment as keyof typeof DEVICE_DISTRIBUTION]
      : SEGMENT_DISTRIBUTION[segment as keyof typeof SEGMENT_DISTRIBUTION];

    result[segment] = baseData.map(step => ({
      ...step,
      visitors: Math.floor(step.visitors * multiplier),
      revenueAtRisk: Math.floor(step.revenueAtRisk * multiplier),
    }));
  });

  return result;
};

export const generateOverTimeData = (
  config: FunnelDefinition,
  days: number = 30
): Array<{date: string; [stepName: string]: number | string}> => {
  const baseData = generateRealisticFunnelData(config);
  const dates: string[] = [];
  
  // Generate dates for last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates.map((date, dayIdx) => {
    const dayVariation = 0.85 + Math.sin(dayIdx * 0.3) * 0.15; // Weekly pattern
    const result: any = { date };
    
    config.steps.forEach((step, stepIdx) => {
      const baseValue = baseData[stepIdx].visitors;
      result[step.name] = Math.floor(baseValue * dayVariation * (0.9 + Math.random() * 0.2));
    });
    
    return result;
  });
};

export const generateFrictionData = (stepName: string): Array<{
  element: string;
  clicks: number;
  failures: number;
  failure_rate: number;
}> => {
  const friction = FRICTION_BY_STEP[stepName] || [];
  return friction.map(fp => {
    const clicks = Math.floor(800 + Math.random() * 1200);
    const failures = Math.floor(clicks * (fp.failure_rate));
    return {
      element: fp.element,
      clicks,
      failures,
      failure_rate: Math.round(fp.failure_rate * 100 * 10) / 10,
    };
  });
};
