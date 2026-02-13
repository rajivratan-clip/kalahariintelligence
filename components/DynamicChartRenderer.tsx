import React from 'react';
import ChartRenderer from './ChartRenderer';
import type { ChartType } from './ChartRenderer';

export interface ComponentSpec {
  component: ChartType | 'AreaChart' | 'BarChart' | 'LineChart' | 'PieChart' | 'ComposedChart';
  data: any[];
  config: {
    xKey?: string;
    yKey?: string;
    dataKey?: string;
    title?: string;
    colors?: string[];
    [key: string]: any;
  };
  title: string;
}

interface DynamicChartRendererProps {
  spec: ComponentSpec;
  fallbackToDefault?: boolean;
}

const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = ({
  spec,
  fallbackToDefault = true,
}) => {
  const { component, data, config, title } = spec;

  // Map component names to ChartType
  const mapComponentToChartType = (comp: string): ChartType => {
    const mapping: Record<string, ChartType> = {
      AreaChart: 'area',
      BarChart: 'bar',
      LineChart: 'line',
      PieChart: 'pie',
      ComposedChart: 'composed',
      ScatterChart: 'scatter',
    };
    return mapping[comp] || 'bar';
  };

  const chartType = mapComponentToChartType(component);

  // Use existing ChartRenderer component
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      )}
      <ChartRenderer
        type={chartType}
        data={data}
        xKey={config.xKey || 'name'}
        yKey={config.yKey || 'value'}
        dataKey={config.dataKey || config.yKey || 'value'}
        colors={config.colors}
        {...config}
      />
    </div>
  );
};

export default DynamicChartRenderer;
