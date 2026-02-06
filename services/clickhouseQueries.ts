/**
 * ClickHouse Query Builder
 * 
 * This service provides optimized queries for your ClickHouse schema:
 * - raw_events: Behavioral layer
 * - sessions: Performance layer  
 * - mv_funnel_performance: Fast aggregated view
 * - friction_points: Intelligence layer
 * - guest_segment_benchmarks: ABV data
 */

export interface QueryOptions {
  location?: string;
  dateRange?: { start: string; end: string };
  groupBy?: 'device_type' | 'guest_segment' | 'traffic_source';
  countingBy?: 'unique_users' | 'sessions' | 'events';
  completedWithin?: number; // days
}

/**
 * Build funnel query based on counting method
 */
export const buildFunnelQuery = (
  funnelSteps: number[],
  options: QueryOptions = {}
): string => {
  const { location, groupBy, countingBy = 'unique_users' } = options;
  const stepsList = funnelSteps.join(', ');
  
  // Determine count expression based on counting method
  let countExpr: string;
  if (countingBy === 'unique_users') {
    countExpr = 'count(DISTINCT s.user_id)';
  } else if (countingBy === 'sessions') {
    countExpr = 'count(DISTINCT re.session_id)';
  } else {
    countExpr = 'count(*)'; // events
  }
  
  const groupByCol = groupBy ? `s.${groupBy}` : "''";
  const groupByClause = groupBy ? `, ${groupByCol}` : '';
  
  if (location) {
    // Query from raw_events + sessions for location filtering
    return `
      SELECT 
        re.funnel_step,
        ${groupByCol} AS segment,
        ${countExpr} AS reached_count,
        sum(COALESCE(s.potential_revenue, 0)) AS potential_revenue_sum
      FROM raw_events re
      INNER JOIN sessions s ON re.session_id = s.session_id
      WHERE re.funnel_step IN (${stepsList})
        AND (s.final_location = '${location}' 
             OR s.final_location LIKE '%${location}%')
      GROUP BY re.funnel_step${groupByClause}
      ORDER BY re.funnel_step${groupByClause ? `, ${groupByCol}` : ''}
    `;
  } else {
    // Use fast materialized view
    return `
      SELECT 
        funnel_step,
        ${groupByCol} AS segment,
        sum(reached_count) AS reached_count,
        sum(potential_revenue_sum) AS potential_revenue_sum
      FROM mv_funnel_performance
      WHERE funnel_step IN (${stepsList})
      ${groupBy ? `GROUP BY funnel_step, ${groupByCol}` : 'GROUP BY funnel_step'}
      ORDER BY funnel_step${groupByClause ? `, ${groupByCol}` : ''}
    `;
  }
};

/**
 * Build over-time query for trend analysis
 */
export const buildOverTimeQuery = (
  funnelSteps: number[],
  days: number = 30,
  options: QueryOptions = {}
): string => {
  const { location, countingBy = 'unique_users' } = options;
  const stepsList = funnelSteps.join(', ');
  
  let countExpr: string;
  if (countingBy === 'unique_users') {
    countExpr = 'count(DISTINCT s.user_id)';
  } else if (countingBy === 'sessions') {
    countExpr = 'count(DISTINCT re.session_id)';
  } else {
    countExpr = 'count(*)';
  }
  
  const locationFilter = location 
    ? `AND (s.final_location = '${location}' OR s.final_location LIKE '%${location}%')`
    : '';
  
  return `
    SELECT 
      toDate(re.timestamp) AS date,
      re.funnel_step,
      ${countExpr} AS count
    FROM raw_events re
    ${location ? 'INNER JOIN sessions s ON re.session_id = s.session_id' : ''}
    WHERE re.funnel_step IN (${stepsList})
      AND re.timestamp >= now() - INTERVAL ${days} DAY
      ${locationFilter}
    GROUP BY date, re.funnel_step
    ORDER BY date, re.funnel_step
  `;
};

/**
 * Build user segmentation query
 */
export const buildSegmentationQuery = (
  segmentBy: 'device_type' | 'guest_segment' | 'traffic_source',
  options: QueryOptions = {}
): string => {
  const { location } = options;
  
  const locationFilter = location
    ? `WHERE final_location = '${location}' OR final_location LIKE '%${location}%'`
    : '';
  
  return `
    SELECT 
      ${segmentBy},
      count(DISTINCT session_id) AS sessions,
      count(DISTINCT user_id) AS unique_users,
      sum(CASE WHEN converted = 1 THEN 1 ELSE 0 END) AS conversions,
      avg(final_total_price) AS avg_booking_value,
      avg(intent_score) AS avg_intent_score
    FROM sessions
    ${locationFilter}
    GROUP BY ${segmentBy}
    ORDER BY sessions DESC
  `;
};
