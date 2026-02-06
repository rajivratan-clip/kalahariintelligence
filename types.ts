export interface FunnelStep {
  id: string;
  name: string;
  event_name: string;
  visitors: number;
  conversionRate: number; // from previous step
  dropOffRate: number;
  revenueAtRisk: number;
  avgTime: string;
  topFriction?: string;
  frictionPoints?: FrictionPoint[];
  filters?: Record<string, any>;
  sparkline?: number[]; // For conversion over time
}

export interface FrictionPoint {
  element: string;
  clicks: number;
  failures: number;
  failure_rate: number;
}

export interface FunnelStepConfig {
  id: string;
  name: string;
  event_name: string;
  category: 'generic' | 'hospitality';
  filters?: Record<string, any>;
}

export interface FunnelDefinition {
  steps: FunnelStepConfig[];
  // Amplitude-style "Measured As" = View Type
  view_type: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance';
  // Conversion window: "Completed within X days"
  completed_within: number; // days (1, 7, 30, etc.)
  // Counting unit: "Counting by Unique User(s)" / Sessions / Events
  counting_by: 'unique_users' | 'sessions' | 'events';
  order: 'strict' | 'loose' | 'any';
  group_by?: 'device_type' | 'guest_segment' | 'traffic_source' | null;
  global_filters?: {
    date_range?: { start: string; end: string };
    location?: string;
  };
  compare_segment?: string | null;
  // Legacy support (will be mapped to counting_by)
  measure?: 'guests' | 'revenue' | 'intent';
  window?: '1hr' | '24hr' | '7 Days' | '30 Days';
}

export interface SegmentData {
  id: string;
  name: string;
  bookingVelocity: number; // Hours
  frictionIndex: number; // 0-100
  priceSensitivity: number; // 0-100
  intentScore: number; // 0-100
  avgCartValue: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export type ViewMode = 'funnel' | 'segment' | 'friction';

export interface AiContext {
  contextName: string;
  data: any;
  prompt: string;
}
