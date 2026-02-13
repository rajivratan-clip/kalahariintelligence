import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartType } from './ChartTypeSelector';

interface ChartRendererProps {
  data: any[];
  chartType: ChartType;
  dataKeys: string[]; // Keys to display in the chart
  xAxisKey?: string; // Key for X-axis (default: first key or 'name')
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  barRadius?: number[];
  stacked?: boolean; // For bar/area charts
  yAxisLabel?: string;
  xAxisLabel?: string;
  tooltipFormatter?: (value: any, name: string) => [string, string];
  yAxisFormatter?: (value: any) => string;
}

const DEFAULT_COLORS = [
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#06b6d4', // cyan
  '#64748b', // slate
];

const ChartRenderer: React.FC<ChartRendererProps> = ({
  data,
  chartType,
  dataKeys,
  xAxisKey,
  colors = DEFAULT_COLORS,
  height = 300,
  showLegend = true,
  showGrid = true,
  barRadius = [8, 8, 0, 0],
  stacked = false,
  yAxisLabel,
  xAxisLabel,
  tooltipFormatter,
  yAxisFormatter,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-slate-500">
        <div className="text-center">
          <p className="text-sm font-medium">No data available</p>
          <p className="text-xs mt-1">Select a date range to view chart data</p>
        </div>
      </div>
    );
  }

  const xKey = xAxisKey || (data[0]?.date ? 'date' : data[0]?.name ? 'name' : Object.keys(data[0])[0]);
  
  const commonProps = {
    data,
    margin: { top: 5, right: 20, left: 0, bottom: 5 },
  };

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={yAxisFormatter}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={tooltipFormatter}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={barRadius}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={yAxisFormatter}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={tooltipFormatter}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={yAxisFormatter}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={tooltipFormatter}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId={stacked ? 'stack' : index.toString()}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={stacked ? 1 : 0.6}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        // For pie charts, we need to transform the data
        const pieData = data.map((item, index) => ({
          name: item[xKey] || `Item ${index + 1}`,
          value: dataKeys.reduce((sum, key) => sum + (Number(item[key]) || 0), 0),
        }));
        
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Value']}
            />
            {showLegend && <Legend />}
          </PieChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={yAxisFormatter}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={tooltipFormatter}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {/* First key as bar */}
            {dataKeys.length > 0 && (
              <Bar dataKey={dataKeys[0]} fill={colors[0]} radius={barRadius} />
            )}
            {/* Remaining keys as lines */}
            {dataKeys.slice(1).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[(index + 1) % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </ComposedChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={yAxisFormatter}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={tooltipFormatter}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {dataKeys.map((key, index) => (
              <Scatter
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
              />
            ))}
          </ScatterChart>
        );

      default:
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip />
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default ChartRenderer;
