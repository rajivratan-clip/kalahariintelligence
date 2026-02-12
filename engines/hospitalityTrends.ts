export interface FunnelStepTrend {
  step_id: string;
  step_label: string;
  current_conversion: number; // e.g. 0.32 (32%)
  historic_avg_conversion: number;
  current_visitors?: number;
  historic_avg_visitors?: number;
}

export interface TrendAnomaly {
  step_id: string;
  step_label: string;
  delta_pct: number; // (current - historic) / historic * 100
  severity: 'low' | 'medium' | 'high';
  reason: string;
  metric_type: 'conversion' | 'visitors';
}

export interface TrendAnalysisResult {
  anomalies: TrendAnomaly[];
  hasSevere: boolean;
  summary?: string;
}

/**
 * Analyzes funnel step trends and detects anomalies based on conversion rate drops
 * @param steps Array of funnel step trends with current vs historic metrics
 * @param thresholdPct Percentage threshold for flagging anomalies (default 15%)
 * @returns Analysis result with detected anomalies
 */
export function analyzeHospitalityTrends(
  steps: FunnelStepTrend[],
  thresholdPct: number = 15
): TrendAnalysisResult {
  const anomalies: TrendAnomaly[] = [];

  for (const step of steps) {
    const {
      step_id,
      step_label,
      current_conversion,
      historic_avg_conversion,
      current_visitors,
      historic_avg_visitors,
    } = step;

    // Check conversion rate anomaly
    if (historic_avg_conversion && historic_avg_conversion > 0) {
      const deltaPct =
        ((current_conversion - historic_avg_conversion) / historic_avg_conversion) * 100;

      if (deltaPct <= -thresholdPct) {
        let severity: TrendAnomaly['severity'] = 'medium';
        if (deltaPct <= -2 * thresholdPct) severity = 'high';
        else if (deltaPct <= -thresholdPct * 0.5) severity = 'low';

        anomalies.push({
          step_id,
          step_label,
          delta_pct: Math.round(deltaPct * 10) / 10,
          severity,
          metric_type: 'conversion',
          reason: `Conversion at "${step_label}" is ${Math.abs(
            Math.round(deltaPct)
          )}% below the ${(historic_avg_conversion * 100).toFixed(1)}% 30-day average. This could indicate a revenue leak.`,
        });
      }
    }

    // Check visitor volume anomaly (if data available)
    if (
      current_visitors !== undefined &&
      historic_avg_visitors !== undefined &&
      historic_avg_visitors > 0
    ) {
      const volumeDeltaPct =
        ((current_visitors - historic_avg_visitors) / historic_avg_visitors) * 100;

      // Flag significant drops in visitor volume
      if (volumeDeltaPct <= -20) {
        const severity: TrendAnomaly['severity'] =
          volumeDeltaPct <= -40 ? 'high' : volumeDeltaPct <= -20 ? 'medium' : 'low';

        anomalies.push({
          step_id,
          step_label,
          delta_pct: Math.round(volumeDeltaPct * 10) / 10,
          severity,
          metric_type: 'visitors',
          reason: `Visitor volume at "${step_label}" dropped ${Math.abs(
            Math.round(volumeDeltaPct)
          )}% compared to 30-day average. This may indicate traffic quality issues or UX problems.`,
        });
      }
    }
  }

  const hasSevere = anomalies.some((a) => a.severity === 'high');

  let summary: string | undefined;
  if (anomalies.length > 0) {
    const highSeverity = anomalies.filter((a) => a.severity === 'high').length;
    summary = `Detected ${anomalies.length} anomaly${anomalies.length > 1 ? 'ies' : ''}${
      highSeverity > 0 ? ` (${highSeverity} high severity)` : ''
    } across the funnel.`;
  }

  return {
    anomalies,
    hasSevere,
    summary,
  };
}

/**
 * Calculates intent score (0-100) based on funnel depth and engagement
 * @param funnelDepth Number of steps completed (0 = just landed, 6 = completed booking)
 * @param maxSteps Total steps in funnel
 * @param timeOnSite Seconds spent on site
 * @param hasInteractions Whether user has meaningful interactions (clicks, scrolls)
 * @returns Intent score 0-100
 */
export function calculateIntentScore(
  funnelDepth: number,
  maxSteps: number,
  timeOnSite: number = 0,
  hasInteractions: boolean = false
): number {
  // Base score from funnel depth (0-70 points)
  const depthScore = (funnelDepth / maxSteps) * 70;

  // Time-based score (0-20 points)
  // 2+ minutes = high intent, 30s-2min = medium, <30s = low
  let timeScore = 0;
  if (timeOnSite >= 120) timeScore = 20;
  else if (timeOnSite >= 30) timeScore = 10;
  else if (timeOnSite > 0) timeScore = 5;

  // Interaction bonus (0-10 points)
  const interactionScore = hasInteractions ? 10 : 0;

  return Math.min(100, Math.round(depthScore + timeScore + interactionScore));
}

/**
 * Estimates revenue at risk based on drop-off rates and average booking value
 * @param dropOffRate Percentage of users dropping off (0-1)
 * @param usersAtStep Number of users at this step
 * @param avgBookingValue Average booking value in dollars
 * @returns Estimated revenue at risk
 */
export function estimateRevenueAtRisk(
  dropOffRate: number,
  usersAtStep: number,
  avgBookingValue: number
): number {
  const usersDropping = usersAtStep * dropOffRate;
  return usersDropping * avgBookingValue;
}
