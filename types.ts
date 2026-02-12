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

export type ViewMode = 'analytics' | 'funnel' | 'segment' | 'friction';

export interface AiContext {
  contextName: string;
  data: any;
  prompt: string;
}

/** Updates the AI can apply to build charts (guided build flow) */
export interface AnalyticsConfigUpdate {
  /** High-level: which analysis surface to control */
  analysis_type?: 'funnel' | 'segmentation';

  /** Shared: \"Measured as\" / metric selection */
  measurement?: string;

  /** Funnel-specific: step configuration */
  funnel_steps?: Array<{
    id: string;
    label: string;
    event_type: string;
    event_category: 'generic' | 'hospitality';
  }>;

  /** Funnel-specific: advanced configuration knobs */
  funnel_view_type?: FunnelDefinition['view_type'];
  funnel_completed_within?: number;
  funnel_counting_by?: FunnelDefinition['counting_by'];
  funnel_order?: FunnelDefinition['order'];
  funnel_group_by?: FunnelDefinition['group_by'];
  funnel_segments?: SegmentComparison[];
  funnel_global_filters?: FunnelDefinition['global_filters'];

  /** Segmentation-specific: which mode to use (event / behavioral / guest) */
  segment_mode?: 'event' | 'behavioral' | 'guest';

  /** Segmentation-specific: event-based config (when segment_mode === 'event') */
  segment_events?: Array<{
    id: string;
    event_type: string;
    event_category: 'generic' | 'hospitality' | 'custom';
    filters?: EventFilter[];
    label?: string;
  }>;
  segment_measurement?: string;
  segment_group_by?: string | null;
  segment_time_period_days?: number;
  segment_interval?: 'day' | 'week' | 'month';
}

/** AI Intelligence Layer Types */
export type LayoutTemplate =
  | 'SINGLE_CHART'
  | 'COMPARISON_GRID'
  | 'EXECUTIVE_SUMMARY_DASHBOARD';

export interface AiReasoning {
  observation: string;
  prediction: string;
  action_score: number; // 0-100 urgency
}

export interface ViewConfig {
  id: string;
  analysis_type?: 'funnel' | 'segmentation' | 'retention' | 'paths';
  measurement?: string;
  funnel_definition?: FunnelDefinition;
  segmentation_state?: {
    mode?: 'event' | 'behavioral' | 'guest';
    events?: any[];
    measurement?: string;
    group_by?: string | null;
  };
  layout_template: LayoutTemplate;
  ai_reasoning?: AiReasoning;
  created_at?: string;
}

/** Enhanced AI response with view configuration */
export interface AiEngineResponse {
  markdown: string; // Chat response text
  view_config?: ViewConfig; // Optional view configuration
  config_updates?: AnalyticsConfigUpdate; // Backward compatible config updates
  proactive_insights?: Array<{
    title: string;
    message: string;
    action_score: number;
    suggested_action?: string;
  }>;
}
