import React from 'react';
import { BarChart3, LineChart as LineChartIcon, PieChart, AreaChart as AreaChartIcon, ScatterChart, TrendingUp, Layers } from 'lucide-react';

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'composed' | 'scatter';

interface ChartTypeOption {
  id: ChartType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const CHART_TYPES: ChartTypeOption[] = [
  {
    id: 'bar',
    label: 'Bar Chart',
    icon: BarChart3,
    description: 'Compare values across categories'
  },
  {
    id: 'line',
    label: 'Line Chart',
    icon: LineChartIcon,
    description: 'Show trends over time'
  },
  {
    id: 'area',
    label: 'Area Chart',
    icon: AreaChartIcon,
    description: 'Show cumulative trends'
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    icon: PieChart,
    description: 'Show proportions'
  },
  {
    id: 'composed',
    label: 'Composed Chart',
    icon: Layers,
    description: 'Combine multiple chart types'
  },
  {
    id: 'scatter',
    label: 'Scatter Plot',
    icon: ScatterChart,
    description: 'Show correlations'
  }
];

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  availableTypes?: ChartType[]; // Optional: restrict available types
  className?: string;
}

const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onChange,
  availableTypes,
  className = ''
}) => {
  const typesToShow = availableTypes || CHART_TYPES.map(t => t.id);
  const options = CHART_TYPES.filter(t => typesToShow.includes(t.id));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Chart Type:</span>
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              title={option.description}
              className={`
                flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${isActive
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-purple-600' : 'text-slate-500'} />
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChartTypeSelector;
