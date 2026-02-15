import { create } from 'zustand';
import type { AnalyticsConfigUpdate, FunnelDefinition } from '../types';

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

export interface StructuredMessagePayload {
  type: 'funnel_analysis';
  summary?: string;
  metrics?: { total_visitors: number; final_conversions: number; overall_conversion_rate: number; total_dropped: number };
  chart_data?: Array<{ step_name: string; visitors: number; conversion_rate: number; drop_off_count: number; drop_off_rate: number }>;
  causes?: string[];
  suggested_actions?: Array<{ label: string; action_id: string }>;
}

export interface ChatMessageLite {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
  /** When AI returns structured response (e.g. funnel_analysis) */
  structured?: StructuredMessagePayload;
}

export interface SessionContext {
  id: string;
  title: string;
  messages: ChatMessageLite[];
  /** last 5 analyses / views in this session (for "compare to last month") */
  analyses: ViewConfig[];
  /** currently active view for this session */
  currentViewConfig?: ViewConfig;
  /** arbitrary metadata: schema, timezone, currency, etc. */
  metadata: {
    schema?: any;
    timezone?: string;
    currency?: string;
  };
}

interface AiOrchestratorState {
  sessions: SessionContext[];
  activeSessionId: string | null;

  /** Create first session or a new tab */
  createNewSession: (opts?: { title?: string; inheritGlobalsFrom?: string }) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;

  /** Append chat messages and keep last N */
  appendMessage: (sessionId: string, msg: ChatMessageLite) => void;

  /** When AI returns a new / mutated view */
  applyViewConfig: (
    sessionId: string,
    view: ViewConfig,
    maybeConfigUpdate?: AnalyticsConfigUpdate
  ) => void;

  /** Helper: get current session safely */
  getActiveSession: () => SessionContext | null;

  /** Initialize with default session if none exists */
  ensureDefaultSession: () => void;

  /** Summarize conversation for context compression */
  summarizeConversation: (sessionId: string) => Promise<string | null>;
}

export const useAiOrchestrator = create<AiOrchestratorState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  createNewSession: (opts) => {
    const id = crypto.randomUUID?.() ?? String(Date.now());
    const { sessions, activeSessionId } = get();

    const baseGlobals =
      opts?.inheritGlobalsFrom && sessions.length
        ? sessions.find((s) => s.id === opts.inheritGlobalsFrom)?.metadata
        : sessions.find((s) => s.id === activeSessionId)?.metadata;

    const newSession: SessionContext = {
      id,
      title: opts?.title ?? 'New Analysis',
      messages: [],
      analyses: [],
      metadata: {
        timezone: baseGlobals?.timezone ?? 'UTC',
        currency: baseGlobals?.currency ?? 'USD',
        schema: baseGlobals?.schema,
      },
    };

    set({
      sessions: [...sessions, newSession],
      activeSessionId: id,
    });

    return id;
  },

  switchSession: (id) => {
    const { sessions } = get();
    if (!sessions.find((s) => s.id === id)) return;
    set({ activeSessionId: id });
  },

  deleteSession: (id) => {
    const { sessions, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.id !== id);
    const newActiveId =
      activeSessionId === id
        ? filtered.length > 0
          ? filtered[0].id
          : null
        : activeSessionId;
    set({ sessions: filtered, activeSessionId: newActiveId });
  },

  updateSessionTitle: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    }));
  },

  appendMessage: (sessionId, msg) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                { ...msg, timestamp: msg.timestamp ?? new Date().toISOString() },
              ].slice(-50), // Keep last 50 messages
            }
          : s
      ),
    }));
  },

  applyViewConfig: (sessionId, view, maybeConfigUpdate) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;

        const analyses = [...s.analyses, { ...view, created_at: new Date().toISOString() }].slice(-5);

        return {
          ...s,
          analyses,
          currentViewConfig: view,
        };
      }),
    }));

    // Return the config update so parent components can apply it
    return maybeConfigUpdate;
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  ensureDefaultSession: () => {
    const { sessions, activeSessionId } = get();
    if (sessions.length === 0) {
      const defaultId = get().createNewSession({ title: 'Main Analysis' });
      return defaultId;
    }
    if (!activeSessionId && sessions.length > 0) {
      set({ activeSessionId: sessions[0].id });
    }
  },

  summarizeConversation: async (sessionId: string) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.messages.length < 5) {
      return null; // Only summarize if there are 5+ messages
    }

    try {
      // Use Azure GPT to generate summary
      const response = await fetch('http://localhost:8000/api/ai/summarize-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: session.messages.slice(-20), // Last 20 messages
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const summary = data.summary;

      // Store summary in session metadata
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                metadata: {
                  ...s.metadata,
                  conversation_summary: summary,
                  conversation_summary_timestamp: new Date().toISOString(),
                },
              }
            : s
        ),
      }));

      return summary;
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      return null;
    }
  },
}));
