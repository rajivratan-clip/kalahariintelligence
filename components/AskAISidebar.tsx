import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Loader2, Sparkles, AlertCircle, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, AiContext, ViewMode, AnalyticsConfigUpdate } from '../types';
import type { AiEngineResponse } from '../types';
import { generateInsight, fetchSuggestedQuestions, guidedBuild, isBuildIntent } from '../services/geminiService';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import { CheckCircle2, Sparkles as SparklesIcon } from 'lucide-react';

const CLIPERACT_LOGO_URL = "/cliperact-logo.png";

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
    getActiveSession,
    appendMessage,
    applyViewConfig,
    ensureDefaultSession,
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

  // When context changes (user clicked explain on a chart), load suggested questions but don't auto-submit
  useEffect(() => {
    if (context && isOpen) {
      loadSuggestedQuestions(context);
    }
  }, [context, isOpen]);

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

  return (
    <div 
      className={`fixed inset-y-0 right-0 w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-slate-200 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-sm">
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50/50 to-white relative">
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

        {/* Proactive Insights */}
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
        {sessionMessages.map((msg) => (
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
                <div className={`max-w-[80%] p-3 rounded-lg text-sm leading-relaxed ${
                msg.role === 'model' 
                    ? 'bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200/50 prose prose-sm prose-slate max-w-none shadow-sm' 
                    : 'bg-slate-100/80 backdrop-blur-sm text-slate-700 border border-slate-200/50'
                }`}>
                   {msg.role === 'model' ? (
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
                   ) : (
                     msg.text
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
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200">
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
      </div>
    </div>
  );
};

export default AskAISidebar;
