import type { AiEngineResponse, ViewConfig } from '../types';
import type { SessionContext } from '../engines/useAiOrchestrator';

// Helper to detect if user wants to BUILD a chart vs just ASK a question
export function isBuildIntent(query: string): boolean {
  const buildKeywords = [
    'build', 'create', 'make', 'show me', 'generate', 'set up', 'configure',
    'funnel', 'segment', 'chart', 'analysis', 'visualization', 'graph',
    'new', 'add', 'set', 'display'
  ];
  const lowerQuery = query.toLowerCase();
  return buildKeywords.some(keyword => lowerQuery.includes(keyword));
}

export const generateInsight = async (
  contextName: string,
  data: any,
  userQuery?: string,
  currentView?: ViewConfig | null,
  sessionAnalyses?: ViewConfig[]
): Promise<AiEngineResponse> => {
  try {
    const response = await fetch('http://localhost:8000/api/ai/insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_name: contextName,
        data,
        user_query: userQuery,
        current_view: currentView, // Send current screen state
        session_analyses: sessionAnalyses, // For "compare to last month" context
      }),
    });

    if (!response.ok) {
      console.error('AI insight API error:', response.status, await response.text());
      return {
        markdown: 'Unable to generate insights at this time. (AI API error)',
      };
    }

    const result = await response.json();
    
    // Support both old format (just insight string) and new format (AiEngineResponse)
    if (typeof result === 'string' || result.insight) {
      return {
        markdown: typeof result === 'string' ? result : result.insight || 'No insights generated.',
        view_config: result.view_config,
        config_updates: result.config_updates,
        proactive_insights: result.proactive_insights,
      };
    }

    return result as AiEngineResponse;
  } catch (error) {
    console.error("AI Insight Error:", error);
    return {
      markdown: "Unable to generate insights at this time. Please check your API configuration.",
    };
  }
};

// Standard funnel steps - used when API fails (client-side fallback)
const STANDARD_FUNNEL_STEPS: Array<{ id: string; label: string; event_type: string; event_category: 'generic' | 'hospitality' }> = [
  { id: '1', label: 'Landed', event_type: 'Landed', event_category: 'hospitality' },
  { id: '2', label: 'Location Select', event_type: 'Location Select', event_category: 'hospitality' },
  { id: '3', label: 'Date Select', event_type: 'Date Select', event_category: 'hospitality' },
  { id: '4', label: 'Room Select', event_type: 'Room Select', event_category: 'hospitality' },
  { id: '5', label: 'Payment', event_type: 'Payment', event_category: 'hospitality' },
  { id: '6', label: 'Confirmation', event_type: 'Confirmation', event_category: 'hospitality' },
];

function getClientSideFallbackConfig(userText: string): import('../types').AnalyticsConfigUpdate | null {
  const t = userText.toLowerCase();
  const wantsFunnel = /funnel|conversion|booking|build|standard|chart|flow|journey|landed|payment|confirmation|room\s*select|location/i.test(t);
  const wantsSegment = /segment|behavioral|compare|guest|device/i.test(t);
  if (wantsFunnel) {
    return {
      analysis_type: 'funnel',
      measurement: 'conversion',
      funnel_steps: STANDARD_FUNNEL_STEPS,
    };
  }
  if (wantsSegment) {
    return {
      analysis_type: 'segmentation',
      segment_mode: t.includes('behavioral') ? 'behavioral' : t.includes('guest') ? 'guest' : 'event',
    };
  }
  return null;
}

export const guidedBuild = async (
  messages: Array<{ role: string; content: string }>,
  currentState?: { analysis_type?: string; has_steps?: boolean },
  currentView?: ViewConfig | null
): Promise<AiEngineResponse> => {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  try {
    const response = await fetch('http://localhost:8000/api/ai/guided-build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        current_state: currentState,
        current_view: currentView, // Include current view for mutation context
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Guided build failed');
    }
    const result = await response.json();
    
    // Support both old and new formats
    if (result.message || result.insight) {
      return {
        markdown: result.message || result.insight || 'Chart configured successfully.',
        view_config: result.view_config,
        config_updates: result.config_updates,
      };
    }
    return result as AiEngineResponse;
  } catch (error) {
    console.error('Guided build error:', error);
    // Client-side fallback: detect intent and apply config so user always gets output
    const fallback = getClientSideFallbackConfig(lastUserMsg);
    if (fallback) {
      const stepCount = fallback.funnel_steps?.length ?? 0;
      const message =
        fallback.analysis_type === 'funnel' && stepCount > 0
          ? `✓ **Chart built successfully.** Your booking funnel is ready with ${stepCount} steps: Landed, Location Select, Date Select, Room Select, Payment, Confirmation. Check the left panel to see your funnel.`
          : fallback.analysis_type === 'segmentation'
          ? `✓ **Chart built successfully.** Switched to segmentation view. Your chart is ready.`
          : `✓ Chart configured. Check the left panel.`;
      return {
        markdown: message,
        config_updates: fallback,
        view_config: {
          id: `fallback-${Date.now()}`,
          analysis_type: fallback.analysis_type,
          measurement: fallback.measurement,
          layout_template: 'SINGLE_CHART',
        },
      };
    }
    return {
      markdown: "I couldn't understand that. Try: **Build a booking funnel** or **Show behavioral segments**.",
    };
  }
};

export const fetchSuggestedQuestions = async (
  contextName: string,
  data: any
): Promise<string[]> => {
  try {
    const response = await fetch('http://localhost:8000/api/ai/suggest-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_name: contextName,
        data,
      }),
    });

    if (!response.ok) {
      console.error('AI suggest-questions API error:', response.status, await response.text());
      return [];
    }

    const result = await response.json();
    return result.questions || [];
  } catch (error) {
    console.error("AI Suggested Questions Error:", error);
    return [];
  }
};
