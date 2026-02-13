import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import type { FunnelDefinition, SegmentComparison, EventFilter } from '../types';

interface FunnelConfigConfirmationProps {
  initialConfig: FunnelDefinition;
  extractedParams: {
    steps?: string[];
    viewType?: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance';
    segmentComparisons?: Array<{ dimension: string; value: string }>;
    countingBy?: 'unique_users' | 'sessions' | 'events';
    completedWithin?: number;
  };
  onConfirm: (config: FunnelDefinition) => void;
  onCancel: () => void;
}

const FunnelConfigConfirmation: React.FC<FunnelConfigConfirmationProps> = ({
  initialConfig,
  extractedParams,
  onConfirm,
  onCancel,
}) => {
  const [config, setConfig] = useState<FunnelDefinition>(() => {
    // Ensure segments are properly initialized from extracted params
    let segments = initialConfig.segments || [];
    
    // If extracted params have segmentComparisons but config doesn't have segments, create them
    if (extractedParams.segmentComparisons && extractedParams.segmentComparisons.length > 0 && segments.length === 0) {
      segments = extractedParams.segmentComparisons.map((seg, idx) => ({
        id: `segment-${idx + 1}`,
        name: `${seg.dimension} = ${seg.value}`,
        filters: [{
          property: seg.dimension,
          operator: 'equals' as const,
          value: seg.value,
        }],
      }));
    }

    return {
      ...initialConfig,
      segments,
    };
  });
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  // Segment property options
  const SEGMENT_PROPERTIES = [
    {
      property: 'device_type',
      label: '📱 Device Type',
      values: ['mobile', 'tablet', 'desktop'],
    },
    {
      property: 'guest_segment',
      label: '👥 Guest Segment',
      values: ['Family', 'Business', 'Couples', 'VIP', 'Corporate', 'Groups'],
    },
    {
      property: 'traffic_source',
      label: '🔗 Traffic Source',
      values: ['google', 'facebook', 'instagram', 'bing', 'email', 'direct'],
    },
  ];

  const handleAddSegment = () => {
    const newSegment: SegmentComparison = {
      id: Date.now().toString(),
      name: `Segment ${(config.segments?.length || 0) + 1}`,
      filters: [],
    };
    setConfig(prev => ({
      ...prev,
      segments: [...(prev.segments || []), newSegment],
    }));
    setEditingSegmentId(newSegment.id);
  };

  const handleRemoveSegment = (segmentId: string) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).filter(s => s.id !== segmentId),
    }));
    if (editingSegmentId === segmentId) {
      setEditingSegmentId(null);
    }
  };

  const handleAddSegmentFilter = (segmentId: string, property: string, value: string) => {
    const filter: EventFilter = {
      property,
      operator: 'equals',
      value,
    };
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId
          ? { ...s, filters: [...s.filters, filter] }
          : s
      ),
    }));
  };

  const handleRemoveSegmentFilter = (segmentId: string, filterIndex: number) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId
          ? { ...s, filters: s.filters.filter((_, idx) => idx !== filterIndex) }
          : s
      ),
    }));
  };

  const handleUpdateSegmentName = (segmentId: string, name: string) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId ? { ...s, name } : s
      ),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Confirm Funnel Configuration</h3>
            <p className="text-sm text-slate-600 mt-1">Review and edit the extracted parameters before building</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Funnel Steps */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Funnel Steps</h4>
            <div className="flex flex-wrap gap-2">
              {config.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-700"
                >
                  {idx + 1}. {step.label || step.event_type}
                </div>
              ))}
            </div>
          </div>

          {/* Measured As */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Measured As</h4>
            <select
              value={config.view_type}
              onChange={(e) =>
                setConfig(prev => ({
                  ...prev,
                  view_type: e.target.value as FunnelDefinition['view_type'],
                }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="conversion">Conversion</option>
              <option value="overTime">Over Time</option>
              <option value="timeToConvert">Time to Convert</option>
              <option value="frequency">Frequency</option>
              <option value="improvement">Improvement</option>
              <option value="significance">Significance</option>
            </select>
          </div>

          {/* Segment Comparison */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">Segment Comparison</h4>
              <button
                onClick={handleAddSegment}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Segment
              </button>
            </div>

            {config.segments && config.segments.length > 0 ? (
              <div className="space-y-3">
                {config.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        value={segment.name}
                        onChange={(e) => handleUpdateSegmentName(segment.id, e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Segment name"
                      />
                      <button
                        onClick={() => handleRemoveSegment(segment.id)}
                        className="ml-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Filters */}
                    <div className="space-y-2">
                      {segment.filters.map((filter, filterIdx) => (
                        <div
                          key={filterIdx}
                          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg"
                        >
                          <span className="text-xs text-slate-600">
                            {SEGMENT_PROPERTIES.find(p => p.property === filter.property)?.label || filter.property}
                          </span>
                          <span className="text-xs text-slate-400">=</span>
                          <span className="text-xs font-medium text-slate-900">{String(filter.value)}</span>
                          <button
                            onClick={() => handleRemoveSegmentFilter(segment.id, filterIdx)}
                            className="ml-auto text-red-600 hover:text-red-700"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      {/* Add Filter */}
                      {editingSegmentId === segment.id && (
                        <SegmentFilterAdder
                          segmentId={segment.id}
                          onAddFilter={(property, value) => {
                            handleAddSegmentFilter(segment.id, property, value);
                          }}
                          onDone={() => setEditingSegmentId(null)}
                          segmentProperties={SEGMENT_PROPERTIES}
                        />
                      )}

                      {editingSegmentId !== segment.id && (
                        <button
                          onClick={() => setEditingSegmentId(segment.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded"
                        >
                          <Plus size={12} />
                          Add Filter
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic py-4 text-center border border-dashed border-slate-300 rounded-lg">
                No segments added. Click "Add Segment" to compare different user groups.
              </div>
            )}
          </div>

          {/* Completed Within */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Completed Within</h4>
            <select
              value={config.completed_within}
              onChange={(e) =>
                setConfig(prev => ({
                  ...prev,
                  completed_within: parseInt(e.target.value),
                }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {/* Counting By */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Counting By</h4>
            <select
              value={config.counting_by}
              onChange={(e) =>
                setConfig(prev => ({
                  ...prev,
                  counting_by: e.target.value as FunnelDefinition['counting_by'],
                }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="unique_users">Unique Users</option>
              <option value="sessions">Sessions</option>
              <option value="events">Events</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Auto-set group_by based on first segment's dimension
              let finalConfig = { ...config };
              if (config.segments && config.segments.length > 0) {
                const firstSegment = config.segments[0];
                if (firstSegment.filters && firstSegment.filters.length > 0) {
                  const firstFilter = firstSegment.filters[0];
                  const dimension = firstFilter.property;
                  if (dimension === 'device_type' || dimension === 'guest_segment' || dimension === 'traffic_source') {
                    finalConfig.group_by = dimension;
                  }
                }
              } else {
                finalConfig.group_by = null;
              }
              onConfirm(finalConfig);
            }}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium flex items-center gap-2 transition-colors"
          >
            <CheckCircle2 size={18} />
            Confirm & Build Chart
          </button>
        </div>
      </div>
    </div>
  );
};

// Segment Filter Adder Component
interface SegmentFilterAdderProps {
  segmentId: string;
  onAddFilter: (property: string, value: string) => void;
  onDone: () => void;
  segmentProperties: Array<{ property: string; label: string; values: string[] }>;
}

const SegmentFilterAdder: React.FC<SegmentFilterAdderProps> = ({
  segmentId,
  onAddFilter,
  onDone,
  segmentProperties,
}) => {
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedValue, setSelectedValue] = useState('');

  const selectedProp = segmentProperties.find(p => p.property === selectedProperty);
  const availableValues = selectedProp?.values || [];

  const handleAdd = () => {
    if (selectedProperty && selectedValue) {
      onAddFilter(selectedProperty, selectedValue);
      setSelectedProperty('');
      setSelectedValue('');
    }
  };

  return (
    <div className="p-3 bg-white border border-brand-200 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={selectedProperty}
          onChange={(e) => {
            setSelectedProperty(e.target.value);
            setSelectedValue(''); // Reset value when property changes
          }}
          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Select property...</option>
          {segmentProperties.map(prop => (
            <option key={prop.property} value={prop.property}>
              {prop.label}
            </option>
          ))}
        </select>

        {selectedProperty && (
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select value...</option>
            {availableValues.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleAdd}
          disabled={!selectedProperty || !selectedValue}
          className="px-3 py-1.5 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>

        <button
          onClick={onDone}
          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default FunnelConfigConfirmation;
