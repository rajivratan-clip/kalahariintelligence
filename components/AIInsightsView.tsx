import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { generateInsight } from '../services/geminiService';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import { fetchFunnelData } from '../services/funnelService';
import type { FunnelDefinition } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIInsightsViewProps {
  config: FunnelDefinition;
  funnelData?: any[];
  onExplain?: (title: string, data: any) => void;
}

const AIInsightsView: React.FC<AIInsightsViewProps> = ({
  config,
  funnelData: providedFunnelData,
  onExplain,
}) => {
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [funnelData, setFunnelData] = useState<any[]>(providedFunnelData || []);
  const { getActiveSession } = useAiOrchestrator();

  // Fetch funnel data if not provided
  useEffect(() => {
    const loadFunnelData = async () => {
      if (providedFunnelData && providedFunnelData.length > 0) {
        setFunnelData(providedFunnelData);
        return;
      }

      try {
        // Default date range: last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const configWithDateRange = {
          ...config,
          global_filters: {
            ...config.global_filters,
            date_range: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0],
            },
          },
        };

        const data = await fetchFunnelData(configWithDateRange);
        setFunnelData(data);
      } catch (err) {
        console.error('Error fetching funnel data:', err);
        setFunnelData([]);
      }
    };

    loadFunnelData();
  }, [config, providedFunnelData]);

  // Generate initial insights on mount and when data changes
  useEffect(() => {
    if (funnelData.length > 0 || config.steps.length > 0) {
      generateInitialInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, funnelData]);

  const generateInitialInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = getActiveSession();
      const currentView = {
        id: 'ai-insights-view',
        analysis_type: 'funnel' as const,
        measurement: 'ai_insights',
        funnel_definition: config,
        layout_template: 'SINGLE_CHART' as const,
      };

      const response = await generateInsight(
        'Funnel AI Insights',
        {
          funnel_config: config,
          funnel_data: funnelData,
          steps: config.steps.map((step, idx) => ({
            step_name: step.label || step.event_type,
            step_index: idx + 1,
            event_type: step.event_type,
          })),
          total_steps: config.steps.length,
          view_type: config.view_type,
          counting_by: config.counting_by,
          completed_within: config.completed_within,
          segments: config.segments || [],
        },
        'Analyze this funnel and provide key insights, anomalies, and recommendations.',
        currentView,
        session?.analyses || []
      );

      setInsights(response.markdown || 'No insights generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate insights');
      setInsights('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!userQuery.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const session = getActiveSession();
      const currentView = {
        id: 'ai-insights-view',
        analysis_type: 'funnel' as const,
        measurement: 'ai_insights',
        funnel_definition: config,
        layout_template: 'SINGLE_CHART' as const,
      };

      const response = await generateInsight(
        'Funnel AI Insights',
        {
          funnel_config: config,
          funnel_data: funnelData,
          steps: config.steps.map((step, idx) => ({
            step_name: step.label || step.event_type,
            step_index: idx + 1,
            event_type: step.event_type,
          })),
          total_steps: config.steps.length,
          view_type: config.view_type,
          counting_by: config.counting_by,
          completed_within: config.completed_within,
          segments: config.segments || [],
        },
        userQuery,
        currentView,
        session?.analyses || []
      );

      setInsights(response.markdown || 'No response generated.');
      setUserQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate response');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 rounded-lg">
            <Sparkles size={20} className="text-brand-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">AI-Powered Funnel Insights</h2>
            <p className="text-sm text-slate-600">
              GPT-powered forensic analysis of your conversion funnel
            </p>
          </div>
        </div>
        <button
          onClick={generateInitialInsights}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh Insights
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
            <p className="text-slate-600">Analyzing your funnel...</p>
            <p className="text-sm text-slate-500 mt-2">This may take a few seconds</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-3">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error Generating Insights</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={generateInitialInsights}
                className="mt-3 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Insights Display */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-2xl font-bold text-slate-900 mb-4" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-lg font-semibold text-slate-900 mt-4 mb-2" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="text-slate-700 mb-4 leading-relaxed" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc list-inside mb-4 space-y-2 text-slate-700" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal list-inside mb-4 space-y-2 text-slate-700" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="ml-4" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-semibold text-slate-900" {...props} />
                    ),
                    code: ({ node, ...props }) => (
                      <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm font-mono text-brand-700" {...props} />
                    ),
                  }}
                >
                  {insights}
                </ReactMarkdown>
              </div>
            </div>

            {/* Ask Follow-up Question */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MessageSquare size={20} className="text-brand-600" />
                Ask a Follow-up Question
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  placeholder="e.g., Why is the drop-off rate high at step 3?"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  disabled={isGenerating}
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={!userQuery.trim() || isGenerating}
                  className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Ask</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Press Enter to submit, or click the Ask button
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Suggested Questions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'What are the main drop-off points in this funnel?',
                  'How does this compare to last week?',
                  'Which segment has the best conversion rate?',
                  'What recommendations do you have to improve conversion?',
                ].map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUserQuery(question);
                      setTimeout(() => handleAskQuestion(), 100);
                    }}
                    className="text-left px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-brand-50 hover:border-brand-200 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsightsView;
