import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}

interface DateFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  className?: string;
}

const PRESET_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 60 days', days: 60 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 180 days', days: 180 },
  { label: 'Last year', days: 365 },
];

const DateFilter: React.FC<DateFilterProps> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate date N days ago
  const getDateDaysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get display text
  const getDisplayText = (): string => {
    if (!value) return 'Select date range';
    if (value.startDate === value.endDate) {
      return formatDateDisplay(value.startDate);
    }
    return `${formatDateDisplay(value.startDate)} - ${formatDateDisplay(value.endDate)}`;
  };

  // Handle preset selection
  const handlePresetSelect = (days: number) => {
    const endDate = today;
    const startDate = getDateDaysAgo(days);
    onChange({ startDate, endDate });
    setIsOpen(false);
    setShowCustomPicker(false);
  };

  // Handle custom date apply
  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      if (customStartDate > customEndDate) {
        // Swap if start is after end
        onChange({ startDate: customEndDate, endDate: customStartDate });
      } else {
        onChange({ startDate: customStartDate, endDate: customEndDate });
      }
      setIsOpen(false);
      setShowCustomPicker(false);
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // Handle clear
  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
    setShowCustomPicker(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-purple-400 hover:bg-purple-50 transition-colors shadow-sm"
      >
        <Calendar size={16} className="text-slate-500" />
        <span className="min-w-[180px] text-left">{getDisplayText()}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false);
              setShowCustomPicker(false);
            }}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-20 min-w-[280px]">
            {/* Preset options */}
            {!showCustomPicker && (
              <>
                <div className="p-2 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    Quick Select
                  </h3>
                </div>
                <div className="py-2">
                  {PRESET_RANGES.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => handlePresetSelect(preset.days)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-slate-200">
                  <button
                    onClick={() => setShowCustomPicker(true)}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  >
                    Custom Range →
                  </button>
                </div>
                {value && (
                  <div className="p-2 border-t border-slate-200">
                    <button
                      onClick={handleClear}
                      className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Custom date picker */}
            {showCustomPicker && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Custom Date Range</h3>
                  <button
                    onClick={() => {
                      setShowCustomPicker(false);
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ← Back
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      max={today}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      max={today}
                      min={customStartDate || undefined}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCustomApply}
                      disabled={!customStartDate || !customEndDate}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomPicker(false);
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DateFilter;
