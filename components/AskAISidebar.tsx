import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Loader2, Sparkles, AlertCircle, TrendingUp, Plus, MessageSquare, BarChart3, Users, DollarSign, GitBranch, FlaskConical, LayoutDashboard, Download, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AiContext, ViewMode, AnalyticsConfigUpdate } from '../types';
import type { AiEngineResponse } from '../types';
import { generateInsight, fetchSuggestedQuestions, guidedBuild, isBuildIntent } from '../services/geminiService';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import { CheckCircle2, Sparkles as SparklesIcon } from 'lucide-react';
import ProactiveHomeBlock from './ProactiveHomeBlock';
import SummaryCard from './SummaryCard';
import FunnelChartCard from './FunnelChartCard';
import ActionBar from './ActionBar';
import ActivityPanel from './ActivityPanel';

const CLIPERACT_LOGO_URL = "/cliperact-logo.png";

const SMART_TEMPLATES = [
  { label: 'Funnel Analysis', question: 'Show funnel for last 7 days and identify the biggest drop-off', icon: BarChart3 },
  { label: 'Retention Analysis', question: 'Show retention analysis for the last 30 days', icon: Users },
  { label: 'Segment Comparison', question: 'Compare mobile vs desktop revenue and conversion', icon: Users },
  { label: 'Revenue Attribution', question: 'Which traffic source drove the most revenue last week?', icon: DollarSign },
  { label: 'A/B Test Summary', question: 'Summarize conversion and revenue by segment for the last 14 days', icon: FlaskConical },
];

const STATIC_TRY_ASKING = [
  'Why is conversion down?',
  'Show funnel for last 7 days',
  'Compare mobile vs desktop revenue',
  'Which campaign performed best?',
  'Find anomaly in last 24h',
];

interface AskAISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: AiContext | null;
  /** Current main view (analytics / funnel / segment / friction). Currently unused in Q&A-only sidebar but accepted for guided-build. */
  activeView?: ViewMode;
  /** Optional hook for guided-build config updates from AI. Ignored in Q&A-only mode. */
  onApplyConfig?: (updates: AnalyticsConfigUpdate) => void;
  /** Current view configuration for sending screen state to AI */
  currentViewConfig?: any;
}

const AskAISidebar: React.FC<AskAISidebarProps> = ({ isOpen, onClose, context, onApplyConfig, currentViewConfig }) => {
  const {
    sessions,
    getActiveSession,
    appendMessage,
    applyViewConfig,
    ensureDefaultSession,
    createNewSession,
    switchSession,
  } = useAiOrchestrator();
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [proactiveInsights, setProactiveInsights] = useState<Array<{
    title: string;
    message: string;
    action_score: number;
    suggested_action?: string;
  }>>([]);
  const [isBuildingChart, setIsBuildingChart] = useState(false);
  const [lastBuiltChart, setLastBuiltChart] = useState<string | null>(null);
  const [explainExpanded, setExplainExpanded] = useState<Record<string, boolean>>({});
  const [explainContent, setExplainContent] = useState<Record<string, string>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});
  const [isAutonomousMode, setIsAutonomousMode] = useState(false);
  const [alertToast, setAlertToast] = useState<string | null>(null);
  const [dashboardToast, setDashboardToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure default session exists
  useEffect(() => {
    ensureDefaultSession();
  }, [ensureDefaultSession]);

  // Add custom animation style
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-slow {
        0%, 100% { opacity: 0.03; transform: scale(1); }
        50% { opacity: 0.05; transform: scale(1.05); }
      }
      .animate-pulse-slow {
        animation: pulse-slow 8s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get current session messages for display (computed dynamically)
  const activeSession = getActiveSession();
  const sessionMessages = activeSession?.messages || [];

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages]);

  // When context changes (user clicked explain on a chart), load suggested questions
  useEffect(() => {
    if (context && isOpen) {
      loadSuggestedQuestions(context);
      return;
    }
    if (isOpen && !context) {
      loadSuggestionsWithAnomalies();
    }
  }, [context, isOpen]);

  const loadSuggestionsWithAnomalies = async () => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch('http://localhost:8000/api/ai/anomalies?limit=5');
      const data = res.ok ? await res.json() : {};
      const anomalies = data.anomalies || [];
      const questions = await fetchSuggestedQuestions('General Query', {}, { anomalies: anomalies.slice(0, 5) });
      setSuggestedQuestions(questions.length > 0 ? questions : STATIC_TRY_ASKING);
    } catch {
      setSuggestedQuestions(STATIC_TRY_ASKING);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const loadSuggestedQuestions = async (ctx: AiContext) => {
    setIsLoadingSuggestions(true);
    try {
      const questions = await fetchSuggestedQuestions(ctx.contextName, ctx.data);
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error('Error loading suggested questions:', error);
      setSuggestedQuestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const session = getActiveSession();
    if (!session) {
      ensureDefaultSession();
      return;
    }

    const questionText = input.trim();
    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      text: questionText,
      timestamp: new Date().toISOString(),
    };

    appendMessage(session.id, userMsg);
    setInput('');
    setIsProcessing(true);

    // Detect if user wants to BUILD a chart
    const wantsToBuild = isBuildIntent(questionText);
    setIsBuildingChart(wantsToBuild);

    try {
      let response: AiEngineResponse;

      if (wantsToBuild) {
        // Use guided build for chart creation
        const conversationHistory = [
          ...session.messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          { role: 'user', content: questionText }
        ];

        const currentState = {
          analysis_type: currentViewConfig?.analysis_type || 'funnel',
          has_steps: currentViewConfig?.funnel_definition?.steps?.length > 0,
        };

        response = await guidedBuild(
          conversationHistory,
          currentState,
          currentViewConfig || session.currentViewConfig
        );

        // Show success feedback
        if (response.config_updates) {
          setLastBuiltChart(response.config_updates.analysis_type || 'chart');
          setTimeout(() => setLastBuiltChart(null), 3000);
        }
      } else {
        // Use regular insight for Q&A
        response = await generateInsight(
          context?.contextName || 'General Query',
          context?.data || {},
          questionText,
          currentViewConfig || session.currentViewConfig,
          session.analyses
        );
      }

      const modelMsg = {
        id: (Date.now() + 1).toString(),
        role: 'model' as const,
        text: response.markdown,
        timestamp: new Date().toISOString(),
        ...(response.type === 'funnel_analysis' && {
          structured: {
            type: 'funnel_analysis' as const,
            summary: response.summary,
            metrics: response.metrics,
            chart_data: response.chart_data,
            causes: response.causes,
            suggested_actions: response.suggested_actions,
          },
        }),
      };

      appendMessage(session.id, modelMsg);

      // Apply view config if AI returned one
      if (response.view_config || response.config_updates) {
        if (response.view_config) {
          applyViewConfig(session.id, response.view_config, response.config_updates);
        }
        if (response.config_updates && onApplyConfig) {
          onApplyConfig(response.config_updates);
        }
      }

      // Show proactive insights if any
      if (response.proactive_insights && response.proactive_insights.length > 0) {
        setProactiveInsights(response.proactive_insights);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      appendMessage(session.id, {
        id: (Date.now() + 2).toString(),
        role: 'model',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsProcessing(false);
      setIsBuildingChart(false);
    }
  };

  const handleQuestionClick = async (question: string) => {
    if (isProcessing) return;

    const session = getActiveSession();
    if (!session) {
      ensureDefaultSession();
      return;
    }

    setIsProcessing(true);
    const wantsToBuild = isBuildIntent(question);
    setIsBuildingChart(wantsToBuild);

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      text: question,
      timestamp: new Date().toISOString(),
    };

    appendMessage(session.id, userMsg);

    try {
      let response: AiEngineResponse;

      if (wantsToBuild) {
        const conversationHistory = [
          ...session.messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          { role: 'user', content: question }
        ];

        const currentState = {
          analysis_type: currentViewConfig?.analysis_type || 'funnel',
          has_steps: currentViewConfig?.funnel_definition?.steps?.length > 0,
        };

        response = await guidedBuild(
          conversationHistory,
          currentState,
          currentViewConfig || session.currentViewConfig
        );

        if (response.config_updates) {
          setLastBuiltChart(response.config_updates.analysis_type || 'chart');
          setTimeout(() => setLastBuiltChart(null), 3000);
        }
      } else {
        response = await generateInsight(
          context?.contextName || 'General Query',
          context?.data || {},
          question,
          currentViewConfig || session.currentViewConfig,
          session.analyses
        );
      }

      const modelMsg = {
        id: (Date.now() + 1).toString(),
        role: 'model' as const,
        text: response.markdown,
        timestamp: new Date().toISOString(),
        ...(response.type === 'funnel_analysis' && {
          structured: {
            type: 'funnel_analysis' as const,
            summary: response.summary,
            metrics: response.metrics,
            chart_data: response.chart_data,
            causes: response.causes,
            suggested_actions: response.suggested_actions,
          },
        }),
      };

      appendMessage(session.id, modelMsg);

      if (response.view_config || response.config_updates) {
        if (response.view_config) {
          applyViewConfig(session.id, response.view_config, response.config_updates);
        }
        if (response.config_updates && onApplyConfig) {
          onApplyConfig(response.config_updates);
        }
      }

      if (response.proactive_insights && response.proactive_insights.length > 0) {
        setProactiveInsights(response.proactive_insights);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      appendMessage(session.id, {
        id: (Date.now() + 2).toString(),
        role: 'model',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsProcessing(false);
      setIsBuildingChart(false);
    }
  };

  const handleNewAnalysis = () => {
    createNewSession({ title: 'New Analysis' });
  };

  const handleTemplateClick = (question: string) => {
    handleQuestionClick(question);
  };

  return (
    <div 
      className={`fixed inset-y-0 right-0 w-full max-w-[640px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-slate-200 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100/80 rounded-lg flex items-center justify-center">
                <img 
                  src={CLIPERACT_LOGO_URL} 
                  alt="Cliperact"
                  className="h-5 w-auto"
                />
            </div>
            <div>
                <h3 className="font-semibold text-slate-900">AI Analyst</h3>
            </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <aside className="w-[200px] flex-shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col py-3">
          <div className="px-3">
            <button
              onClick={handleNewAnalysis}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <Plus size={16} />
              New Analysis
            </button>
          </div>
          <div className="mt-4 px-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Chats</h4>
            <ul className="space-y-0.5">
              {(sessions || []).slice(0, 8).map((s) => {
                const isActive = activeSession?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => switchSession(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                        isActive
                          ? 'bg-[#0947A4]/10 text-[#0947A4] font-medium'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                      title={s.title}
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare size={14} className="flex-shrink-0" />
                        {s.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 px-3 flex-1 min-h-0">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Smart Templates</h4>
            <ul className="space-y-1">
              {SMART_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <li key={t.label}>
                    <button
                      onClick={() => handleTemplateClick(t.question)}
                      disabled={isProcessing}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-200/60 hover:text-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                      title={t.question}
                    >
                      <Icon size={14} className="flex-shrink-0 text-slate-400" />
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-slate-50/50 to-white relative">
      {/* Mode toggle: Chat / Autonomous */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/80 bg-white/60 flex-shrink-0">
        <button
          type="button"
          onClick={() => setIsAutonomousMode(false)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!isAutonomousMode ? 'bg-[#0947A4] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Chat Mode
        </button>
        <button
          type="button"
          onClick={() => setIsAutonomousMode(true)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isAutonomousMode ? 'bg-[#0947A4] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Autonomous Mode
        </button>
      </div>
      {/* Activity panel when Autonomous */}
      {isAutonomousMode && (
        <div className="px-4 py-2 flex-shrink-0">
          <ActivityPanel limit={15} pollIntervalMs={30000} />
        </div>
      )}
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Subtle Animated Background Logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <div className="animate-pulse-slow">
            <img 
              src={CLIPERACT_LOGO_URL} 
              alt=""
              className="h-64 w-auto"
            />
          </div>
        </div>

        {/* Proactive Home - when no messages in this session */}
        {sessionMessages.length === 0 && !isLoadingSuggestions && (
          <ProactiveHomeBlock
            onActionClick={handleQuestionClick}
            isProcessing={isProcessing}
          />
        )}

        {/* Proactive Insights (from AI response) */}
        {proactiveInsights.length > 0 && (
          <div className="p-4 space-y-2 relative z-10">
            {proactiveInsights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  insight.action_score >= 70
                    ? 'bg-red-50 border-red-200'
                    : insight.action_score >= 40
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {insight.action_score >= 70 ? (
                    <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <TrendingUp size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-900 mb-1">{insight.title}</div>
                    <div className="text-xs text-slate-600 mb-2">{insight.message}</div>
                    {insight.suggested_action && (
                      <button
                        onClick={() => {
                          setInput(insight.suggested_action!);
                          handleSubmit(new Event('submit') as any);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        {insight.suggested_action} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sessionMessages.length === 0 && !isLoadingSuggestions ? (
          // Empty state with centered prompt and suggestions
          <div className="flex flex-col items-center justify-center h-full px-6 py-8 relative z-10">
            <div className="text-center mb-8 max-w-sm">
              <div className="flex items-center justify-center gap-2 mb-3">
                <SparklesIcon size={24} className="text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-800">
                  {context ? 'What do you want to know about this chart?' : 'AI Chart Builder'}
                </h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                {context 
                  ? 'Ask questions or request insights about the current chart.'
                  : 'Build charts, analyze funnels, or compare segments. Try: "Build a funnel" or "Show mobile users"'}
              </p>
              
              {/* Quick Actions */}
              {!context && (
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  <button
                    onClick={() => {
                      setInput('Build a booking funnel');
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="px-4 py-2 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors border border-purple-200"
                  >
                    📊 Build Funnel
                  </button>
                  <button
                    onClick={() => {
                      setInput('Show behavioral segments');
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="px-4 py-2 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors border border-blue-200"
                  >
                    👥 Show Segments
                  </button>
                  <button
                    onClick={() => {
                      setInput('Create revenue impact analysis');
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="px-4 py-2 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors border border-green-200"
                  >
                    💰 Revenue Impact
                  </button>
                </div>
              )}
            </div>

            {/* Suggested Questions - Centered Pills */}
            {suggestedQuestions.length > 0 && (
              <div className="flex flex-col gap-3 w-full max-w-sm">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuestionClick(question)}
                    disabled={isProcessing}
                    className="px-5 py-3 text-sm bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200/80 rounded-lg hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Messages view
          <div className="p-4 space-y-4 relative z-10">
        {sessionMessages.map((msg, msgIndex) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'model' ? 'bg-slate-100/80 text-slate-600 backdrop-blur-sm' : 'bg-slate-200/80 text-slate-600 backdrop-blur-sm'
            }`}>
                    {msg.role === 'model' ? (
                      <img 
                        src={CLIPERACT_LOGO_URL} 
                        alt=""
                        className="h-4 w-auto"
                      />
                    ) : (
                      <User size={16} />
                    )}
            </div>
                <div className={`max-w-[100%] min-w-0 ${msg.role === 'model' ? 'space-y-3' : ''} ${
                msg.role === 'model' 
                    ? '' 
                    : 'p-3 rounded-lg text-sm bg-slate-100/80 backdrop-blur-sm text-slate-700 border border-slate-200/50'
                }`}>
                   {msg.role === 'model' && msg.structured?.type === 'funnel_analysis' ? (
                     <div className="space-y-3">
                       {msg.structured.summary && (
                         <SummaryCard
                           summary={msg.structured.summary}
                           primaryMetric="Overall conversion"
                           primaryValue={msg.structured.metrics ? `${msg.structured.metrics.overall_conversion_rate}%` : undefined}
                         />
                       )}
                       {msg.structured.chart_data && msg.structured.chart_data.length > 0 && (
                         <FunnelChartCard chartData={msg.structured.chart_data} />
                       )}
                       {msg.structured.causes && msg.structured.causes.length > 0 && (
                         <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                           <h4 className="text-xs font-semibold text-slate-600 mb-2">Observations</h4>
                           <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                             {msg.structured.causes.map((c, i) => (
                               <li key={i}>{c}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {msg.structured.suggested_actions && msg.structured.suggested_actions.length > 0 && (
                         <ActionBar
                           actions={msg.structured.suggested_actions}
                           onAction={async (actionId, label) => {
                             if (actionId === 'alert') {
                               try {
                                 const res = await fetch('http://localhost:8000/api/alerts', {
                                   method: 'POST',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ message: `Alert: ${msg.structured?.summary || 'Funnel insight'}` }),
                                 });
                                 const data = res.ok ? await res.json() : {};
                                 setAlertToast(data.message || 'Alert created.');
                                 setTimeout(() => setAlertToast(null), 4000);
                               } catch {
                                 setAlertToast('Failed to create alert.');
                                 setTimeout(() => setAlertToast(null), 3000);
                               }
                               return;
                             }
                             setInput(label);
                             handleQuestionClick(label);
                           }}
                           disabled={isProcessing}
                         />
                       )}
                       <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-2">
                         <button
                           type="button"
                           onClick={async () => {
                             try {
                               const res = await fetch('http://localhost:8000/api/dashboard/widgets', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                   widget_type: 'funnel_analysis',
                                   title: msg.structured?.summary?.slice(0, 50) || 'Funnel insight',
                                   config: { chart_data: msg.structured?.chart_data, summary: msg.structured?.summary },
                                 }),
                               });
                               const data = res.ok ? await res.json() : {};
                               setDashboardToast(data.message || 'Added to dashboard.');
                               setTimeout(() => setDashboardToast(null), 4000);
                             } catch {
                               setDashboardToast('Failed to add to dashboard.');
                               setTimeout(() => setDashboardToast(null), 3000);
                             }
                           }}
                           className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                         >
                           <LayoutDashboard size={12} />
                           Add to Dashboard
                         </button>
                         <button
                           type="button"
                           onClick={() => {
                             const payload = {
                               type: 'funnel_analysis',
                               summary: msg.structured?.summary,
                               metrics: msg.structured?.metrics,
                               chart_data: msg.structured?.chart_data,
                               causes: msg.structured?.causes,
                             };
                             const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                             const url = URL.createObjectURL(blob);
                             const a = document.createElement('a');
                             a.href = url;
                             a.download = `funnel-report-${Date.now()}.json`;
                             a.click();
                             URL.revokeObjectURL(url);
                           }}
                           className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                         >
                           <Download size={12} />
                           Export Report
                         </button>
                         <button
                           type="button"
                           onClick={async () => {
                             try {
                               const res = await fetch('http://localhost:8000/api/share', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                   snapshot: {
                                     summary: msg.structured?.summary,
                                     chart_data: msg.structured?.chart_data,
                                   },
                                 }),
                               });
                               const data = res.ok ? await res.json() : {};
                               const url = data.url ? `${window.location.origin}${data.url}` : '';
                               if (url && navigator.clipboard) {
                                 await navigator.clipboard.writeText(url);
                                 setDashboardToast('Share link copied to clipboard.');
                               } else {
                                 setDashboardToast(data.message || 'Share link created.');
                               }
                               setTimeout(() => setDashboardToast(null), 4000);
                             } catch {
                               setDashboardToast('Failed to share.');
                               setTimeout(() => setDashboardToast(null), 3000);
                             }
                           }}
                           className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                         >
                           <Share2 size={12} />
                           Share with Team
                         </button>
                       </div>
                       <div className="pt-1">
                         <button
                           type="button"
                           onClick={async () => {
                             if (explainLoading[msg.id] || explainContent[msg.id]) {
                               setExplainExpanded((e) => ({ ...e, [msg.id]: !e[msg.id] }));
                               return;
                             }
                             setExplainExpanded((e) => ({ ...e, [msg.id]: true }));
                             setExplainLoading((l) => ({ ...l, [msg.id]: true }));
                             try {
                               const prevMsg = msgIndex > 0 ? sessionMessages[msgIndex - 1] : null;
                               const userQuery = prevMsg?.role === 'user' ? prevMsg.text : 'Explain this funnel in more detail.';
                               const funnelConversion = msg.structured?.chart_data?.map((s) => ({
                                 step_name: s.step_name,
                                 visitors: s.visitors,
                                 conversion_rate: s.conversion_rate,
                                 drop_off_count: s.drop_off_count,
                                 drop_off_rate: s.drop_off_rate,
                               })) || [];
                               const res = await fetch('http://localhost:8000/api/ai/insight', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                   context_name: 'Funnel Analysis',
                                   data: { funnel_conversion: funnelConversion },
                                   user_query: userQuery,
                                 }),
                               });
                               const data = res.ok ? await res.json() : {};
                               const markdown = data.insight || 'Unable to load explanation.';
                               setExplainContent((c) => ({ ...c, [msg.id]: markdown }));
                             } catch {
                               setExplainContent((c) => ({ ...c, [msg.id]: 'Unable to load explanation.' }));
                             } finally {
                               setExplainLoading((l) => ({ ...l, [msg.id]: false }));
                             }
                           }}
                           disabled={explainLoading[msg.id]}
                           className="text-xs font-medium text-[#0947A4] hover:text-[#073882] disabled:opacity-50"
                         >
                           {explainLoading[msg.id] ? 'Loading…' : explainContent[msg.id] ? (explainExpanded[msg.id] ? 'Hide explanation' : 'Show explanation') : 'Explain deeper'}
                         </button>
                         {explainExpanded[msg.id] && explainContent[msg.id] && (
                           <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50/80 text-sm prose prose-sm max-w-none">
                             <ReactMarkdown
                               components={{
                                 p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                 ul: ({ node, ...props }) => <ul className="ml-4 mb-2 space-y-0.5" {...props} />,
                                 li: ({ node, ...props }) => <li className="text-slate-700" {...props} />,
                                 strong: ({ node, ...props }) => <strong className="font-semibold text-slate-800" {...props} />,
                               }}
                             >
                               {explainContent[msg.id]}
                             </ReactMarkdown>
                           </div>
                         )}
                       </div>
                     </div>
                   ) : msg.role === 'model' ? (
                     <div className="p-3 rounded-lg bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200/50 prose prose-sm prose-slate max-w-none shadow-sm">
                       <ReactMarkdown
                         components={{
                           h2: ({node, ...props}) => <h2 className="text-base font-bold text-slate-800 mt-3 mb-2" {...props} />,
                           h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-slate-700 mt-2 mb-1" {...props} />,
                           p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                           ul: ({node, ...props}) => <ul className="ml-4 mb-2 space-y-1" {...props} />,
                           ol: ({node, ...props}) => <ol className="ml-4 mb-2 space-y-1" {...props} />,
                           li: ({node, ...props}) => <li className="text-sm" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-semibold text-slate-800" {...props} />,
                           code: ({node, ...props}) => <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs border border-slate-200" {...props} />,
                         }}
                       >
                         {msg.text}
                       </ReactMarkdown>
                     </div>
                   ) : (
                     <span className="p-3 rounded-lg">{msg.text}</span>
                   )}
            </div>
          </div>
        ))}
        {isProcessing && (
            <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-slate-100/80 text-slate-600 flex items-center justify-center backdrop-blur-sm">
                        <img 
                          src={CLIPERACT_LOGO_URL} 
                          alt=""
                          className="h-4 w-auto"
                        />
                 </div>
                     <div className="bg-white/80 backdrop-blur-sm border border-slate-200/50 p-3 rounded-lg flex items-center gap-2 text-sm text-slate-600 shadow-sm">
                        <Loader2 size={14} className="animate-spin text-slate-600" />
                        {isBuildingChart ? 'Building your chart...' : 'Analyzing...'}
                 </div>
            </div>
        )}

        {/* Chart Build Success Indicator */}
        {lastBuiltChart && (
          <div className="p-4 relative z-10">
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-emerald-900">
                  Chart built successfully!
                </div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  Your {lastBuiltChart === 'funnel' ? 'funnel' : lastBuiltChart === 'segmentation' ? 'segmentation' : 'chart'} is ready. Check the main view.
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
          </div>
        )}

        {/* Loading Suggestions Overlay */}
        {isLoadingSuggestions && (
          <div className="flex items-center justify-center h-full relative z-10">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={20} className="animate-spin text-slate-600" />
              <span>Loading suggestions...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 pt-3 bg-white/80 backdrop-blur-sm border-t border-slate-200 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              context 
                ? "Ask a question or build a chart (e.g., 'Build a funnel' or 'Show mobile users')..." 
                : "Select a chart to begin or ask: 'Build a funnel'"
            }
            disabled={isProcessing}
            className="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-300 bg-white/80 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-all"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
              isBuildIntent(input.trim())
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-slate-700 hover:bg-slate-800 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isBuildIntent(input.trim()) ? 'Build chart' : 'Send message'}
          >
            {isBuildIntent(input.trim()) ? (
              <SparklesIcon size={16} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
        {(alertToast || dashboardToast) && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {alertToast || dashboardToast}
          </div>
        )}
        {/* Try asking… - static when no context, context-based when chart selected */}
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Try asking…</p>
          <div className="flex flex-wrap gap-1.5">
            {(suggestedQuestions.length > 0 ? suggestedQuestions : STATIC_TRY_ASKING).map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuestionClick(q)}
                disabled={isProcessing}
                className="px-2.5 py-1.5 text-xs rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 border border-slate-200/80 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default AskAISidebar;
