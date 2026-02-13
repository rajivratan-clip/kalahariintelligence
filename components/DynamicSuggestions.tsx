import React, { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, Filter, BarChart3, Zap, Search } from 'lucide-react';
import type { ViewConfig } from '../engines/useAiOrchestrator';
import { generateSuggestions, type Suggestion } from '../engines/suggestionEngine';

interface DynamicSuggestionsProps {
  currentViewConfig: ViewConfig | null;
  sessionHistory: ViewConfig[];
  onSuggestionClick?: (suggestion: Suggestion) => void;
}

const DynamicSuggestions: React.FC<DynamicSuggestionsProps> = ({
  currentViewConfig,
  sessionHistory,
  onSuggestionClick,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentViewConfig) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    generateSuggestions(currentViewConfig, sessionHistory)
      .then((sugs) => {
        setSuggestions(sugs);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading suggestions:', error);
        setIsLoading(false);
      });
  }, [currentViewConfig, sessionHistory]);

  if (isLoading || suggestions.length === 0) {
    return null;
  }

  const getIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'compare':
        return <TrendingUp size={16} className="text-blue-600" />;
      case 'drill':
        return <Search size={16} className="text-purple-600" />;
      case 'segment':
        return <Filter size={16} className="text-green-600" />;
      case 'forecast':
        return <BarChart3 size={16} className="text-amber-600" />;
      case 'diagnose':
        return <Zap size={16} className="text-red-600" />;
      default:
        return <Lightbulb size={16} className="text-slate-600" />;
    }
  };

  const getTypeLabel = (type: Suggestion['type']) => {
    switch (type) {
      case 'compare':
        return 'Compare';
      case 'drill':
        return 'Drill Down';
      case 'segment':
        return 'Segment';
      case 'forecast':
        return 'Forecast';
      case 'diagnose':
        return 'Diagnose';
      default:
        return 'Suggestion';
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={18} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-700">Suggestions</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSuggestionClick?.(suggestion)}
            className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-purple-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon(suggestion.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-500">
                    {getTypeLabel(suggestion.type)}
                  </span>
                  {suggestion.action_score >= 70 && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                      High Priority
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-purple-600 transition-colors">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                  {suggestion.description}
                </p>
                {suggestion.suggested_action && (
                  <div className="text-xs text-purple-600 font-medium flex items-center gap-1">
                    <span>{suggestion.suggested_action}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DynamicSuggestions;
