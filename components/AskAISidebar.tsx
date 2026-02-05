import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage, AiContext } from '../types';
import { generateInsight } from '../services/geminiService';

interface AskAISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: AiContext | null;
}

const AskAISidebar: React.FC<AskAISidebarProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hello! I am your Hospitality Booking Intelligence Agent. Select a chart to investigate revenue leaks.' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When context triggers (user clicked explain on a chart), auto-submit to AI
  useEffect(() => {
    if (context && isOpen) {
       handleContextTrigger(context);
    }
  }, [context]);

  const handleContextTrigger = async (ctx: AiContext) => {
      // Add a system message about what we are looking at
      const contextMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: `Investigating: ${ctx.contextName}`,
      };
      setMessages(prev => [...prev, contextMsg]);
      setIsProcessing(true);

      const response = await generateInsight(ctx.contextName, ctx.data, ctx.prompt);
      
      setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response
      }]);
      setIsProcessing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    // Pass the current context data if available, otherwise general query
    const response = await generateInsight(
        context?.contextName || 'General Query', 
        context?.data || {}, 
        input
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
      className={`fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-slate-200 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-100 rounded-md">
                <Bot size={20} className="text-brand-600" />
            </div>
            <div>
                <h3 className="font-bold text-slate-800">AskAI Analyst</h3>
                <p className="text-xs text-slate-500">Forensic Revenue Investigation</p>
            </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'model' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
            }`}>
                {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm leading-relaxed shadow-sm ${
                msg.role === 'model' 
                ? 'bg-white border border-slate-100 text-slate-700' 
                : 'bg-indigo-600 text-white'
            }`}>
               {msg.text}
            </div>
          </div>
        ))}
        {isProcessing && (
            <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Bot size={16} />
                 </div>
                 <div className="bg-white border border-slate-100 p-3 rounded-lg flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing patterns...
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue dips or friction..."
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AskAISidebar;
