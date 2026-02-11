import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, AiContext } from '../types';
import { generateInsight, fetchSuggestedQuestions } from '../services/geminiService';

const CLIPERACT_LOGO_URL = "/cliperact-logo.png";

interface AskAISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: AiContext | null;
}

const AskAISidebar: React.FC<AskAISidebarProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When context changes (user clicked explain on a chart), load suggested questions but don't auto-submit
  useEffect(() => {
    if (context && isOpen) {
       loadSuggestedQuestions(context);
       // Keep chat clean - don't show welcome messages when context loads
       setMessages([]);
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

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    const questionText = input;
    setInput('');
    setIsProcessing(true);

    // Pass the current context data if available, otherwise general query
    const response = await generateInsight(
        context?.contextName || 'General Query', 
        context?.data || {}, 
        questionText
    );

    setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response
    }]);
    setIsProcessing(false);
  };

  const handleQuestionClick = async (question: string) => {
    if (isProcessing) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: question };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    const response = await generateInsight(
        context?.contextName || 'General Query', 
        context?.data || {}, 
        question
    );

    setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response
    }]);
    setIsProcessing(false);
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

        {messages.length === 0 && !isLoadingSuggestions ? (
          // Empty state with centered prompt and suggestions
          <div className="flex flex-col items-center justify-center h-full px-6 py-8 relative z-10">
            <div className="text-center mb-8 max-w-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                What do you want to know about this chart?
              </h3>
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
        {messages.map((msg) => (
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
                        Analyzing...
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
            placeholder={context ? "Ask a follow-up question..." : "Select a chart to begin"}
            disabled={!context}
            className="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-300 bg-white/80 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-all"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing || !context}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AskAISidebar;
