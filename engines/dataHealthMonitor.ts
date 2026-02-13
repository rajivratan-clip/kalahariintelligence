/**
 * Data Health Monitor
 * Pre-render data quality checks before chart renders.
 * Checks: null spikes, >3 std deviation, missing events.
 */

export interface DataHealthReport {
  hasIssues: boolean;
  warnings: string[];
  suggestions: string[];
}

/**
 * Check data health for a given dataset and metric.
 */
export async function checkDataHealth(
  data: any[],
  metric: string
): Promise<DataHealthReport> {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!data || data.length === 0) {
    return {
      hasIssues: true,
      warnings: ['No data available for this chart'],
      suggestions: ['Check date range and filters', 'Verify data collection is active'],
    };
  }

  // Check for null/undefined values
  const nullCount = data.filter((d) => {
    const value = d[metric] ?? d.value ?? d.y;
    return value === null || value === undefined || isNaN(value);
  }).length;

  if (nullCount > 0) {
    const nullPct = (nullCount / data.length) * 100;
    if (nullPct > 10) {
      warnings.push(`${nullPct.toFixed(1)}% of data points are missing values`);
      suggestions.push('Check data collection pipeline', 'Verify event tracking is working');
    }
  }

  // Check for outliers (>3 standard deviations)
  const values = data
    .map((d) => {
      const value = d[metric] ?? d.value ?? d.y;
      return typeof value === 'number' ? value : null;
    })
    .filter((v): v is number => v !== null);

  if (values.length > 10) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const outliers = values.filter((v) => Math.abs(v - mean) > 3 * stdDev);
    if (outliers.length > 0) {
      const outlierPct = (outliers.length / values.length) * 100;
      if (outlierPct > 5) {
        warnings.push(
          `Unusual spike detected: ${outlierPct.toFixed(1)}% of values are >3 standard deviations from mean`
        );
        suggestions.push('This may indicate tracking noise or a real anomaly', 'Consider smoothing the data');
      }
    }
  }

  // Check for zero values (might indicate missing events)
  const zeroCount = values.filter((v) => v === 0).length;
  if (zeroCount > data.length * 0.5) {
    warnings.push('More than 50% of data points are zero');
    suggestions.push('Verify events are being tracked correctly', 'Check if filters are too restrictive');
  }

  // Check for sudden drops (consecutive zeros or very low values)
  let consecutiveZeros = 0;
  let maxConsecutiveZeros = 0;
  if (values.length > 0) {
    const calculatedMean = values.reduce((a, b) => a + b, 0) / values.length;
    for (const value of values) {
      if (value === 0 || (value < calculatedMean * 0.1 && calculatedMean > 0)) {
        consecutiveZeros++;
        maxConsecutiveZeros = Math.max(maxConsecutiveZeros, consecutiveZeros);
      } else {
        consecutiveZeros = 0;
      }
    }
  }

  if (maxConsecutiveZeros >= 3) {
    warnings.push(`Data gap detected: ${maxConsecutiveZeros} consecutive zero/low values`);
    suggestions.push('Check if there was a data collection outage', 'Verify date range includes active periods');
  }

  return {
    hasIssues: warnings.length > 0,
    warnings,
    suggestions,
  };
}
