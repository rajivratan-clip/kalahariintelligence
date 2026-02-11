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
  segments?: Record<string, number>; // Segment name -> visitor count
  hasSegments?: boolean;
}

export interface FrictionPoint {
  element: string;
  clicks: number;
  failures: number;
  failure_rate: number;
}

export interface EventFilter {
  property: string;  // e.g., "page_url", "element_text", "funnel_step"
  operator: 
    | 'equals' 
    | 'not_equals' 
    | 'contains' 
    | 'not_contains'
    | 'starts_with' 
    | 'ends_with'
    | 'greater_than' 
    | 'less_than'
    | 'greater_than_or_equal'
    | 'less_than_or_equal'
    | 'in'
    | 'not_in'
    | 'is_null'
    | 'is_not_null';
  value: string | number | boolean | string[] | number[];
}

export interface FunnelStepConfig {
  id: string;
  label?: string;  // User-friendly label (e.g., "Landed on Homepage")
  event_category: 'generic' | 'hospitality';
  event_type: string;  // For generic: "Page Viewed", "Click", etc. For hospitality: "Room Select", "Location Select", etc.
  filters?: EventFilter[];  // List of filters (property, operator, value)
}

export interface SegmentComparison {
  id: string;
  name: string;  // User-defined segment name (e.g., "Mobile Users", "VIP Guests")
  filters: EventFilter[];  // Filters that define this segment
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
  segments?: SegmentComparison[];  // User-defined segments for comparison
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
