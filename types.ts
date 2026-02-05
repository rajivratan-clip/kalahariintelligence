export interface FunnelStep {
  id: string;
  name: string;
  visitors: number;
  conversionRate: number; // from previous step
  dropOffRate: number;
  revenueAtRisk: number;
  avgTime: string;
  topFriction?: string;
}

export interface FunnelDefinition {
  steps: { id: string; name: string; filter?: string }[];
  measure: 'guests' | 'sessions' | 'bookings';
  window: string;
  order: 'strict' | 'loose' | 'any';
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
