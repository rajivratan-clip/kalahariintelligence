# Segmentation Tab – Data Requirements & Logic Analysis

## Executive Summary

The Segmentation tab in Analytics Studio has three modes: **Event-based**, **Behavioral**, and **Guest/User**. This document defines the data required for each mode, current gaps, and the fixes applied.

---

## 1. Event-Based Segmentation

### What It Does
- Analyzes user behavior by **events** (Page Viewed, Room Select, etc.)
- Measurements: Uniques, Event Totals, Average per user, Revenue per User
- Group by: Device Type, Guest Segment, Traffic Source, Browser, Returning vs New
- Time series and breakdown charts

### Data Sources
| Data Point | Table | Column | Status |
|------------|-------|--------|--------|
| Event occurrence | raw_events | event_type, funnel_step, timestamp | ✅ OK |
| Unique users/sessions | raw_events | user_id, session_id | ✅ OK |
| device_type | raw_events | device_type | ✅ OK (mobile, desktop, tablet) |
| guest_segment | raw_events | guest_segment | ⚠️ Different format vs sessions ("Family" vs "family_with_young_kids") |
| traffic_source | sessions | traffic_source | ✅ Use sessions (JOIN); raw_events has utm_source only |
| browser | raw_events | browser | ✅ OK |
| is_returning_visitor | raw_events | is_returning_visitor | ✅ OK |
| Revenue | sessions | conversion_value | ✅ OK (requires JOIN) |

### Hospitality Event Mapping (funnel_step)
| UI Label | funnel_step |
|----------|-------------|
| Page Viewed | 1 |
| Location Select | 2 |
| Date Select | 3 |
| Room Select | 4 |
| Payment | 5 |
| Confirmation | 6 |

### Logic Gaps (Fixed in Code)
1. **group_by traffic_source**: raw_events has no traffic_source → use **sessions** via JOIN, or fallback to utm_source
2. **group_by guest_segment**: For consistency with other analytics, use **sessions.guest_segment** (sessions has canonical values)
3. **Interval**: Request has day/week/month but time_series always used `toDate()` → apply `toStartOfWeek` / `toStartOfMonth` when selected
4. **Divide by zero**: `revenue_per_user` and `average` can divide by zero when no users → add `nullIf(uniqExact(user_id), 0)` or equivalent guard
5. **breakdown group_by**: When property is in sessions, must JOIN sessions

---

## 2. Behavioral Segmentation

### What It Does
- Classifies sessions into: Researchers, Bargain Hunters, Last-Minute Bookers, High-Friction Droppers, High-Intent Non-Bookers, Converters, Other
- Uses **sessions** table only (pre-aggregated metrics)

### Data Sources (sessions table)
| Metric | Column | Type | Used For |
|--------|--------|------|----------|
| Conversions | converted | Bool | converter segment |
| Friction | friction_score | Float32 | high_friction |
| Intent | intent_score | Float32 | high_intent_non_booker |
| Price sensitivity | price_sensitivity_score | Float32 | bargain_hunter |
| Urgency | urgency_score | Float32 | last_minute |
| Price checks | price_checks_count | Int8 | bargain_hunter |
| Discount attempts | discount_code_attempts | Int8 | bargain_hunter |
| Page views | page_views_count | Int16 | researcher |
| Duration | duration_seconds | Int32 | researcher, last_minute |
| Revenue | conversion_value, potential_revenue | Float32, Decimal | metrics |

### Segment Logic (CASE order matters)
1. converter: converted = 1
2. high_friction: friction_score > 0.6 AND converted = 0
3. high_intent_non_booker: intent_score >= 60 AND converted = 0
4. bargain_hunter: price_sensitivity > 0.7 OR price_checks >= 3 OR discount_attempts > 0
5. last_minute: urgency > 0.7 AND duration < 600 sec
6. researcher: page_views >= 5 AND duration > 120 AND converted = 0
7. other: fallback

### Data Requirements for Demos
- `sessions` must be populated with: friction_score, intent_score, urgency_score, price_sensitivity_score (from your session aggregation pipeline)
- If NULL/0, coalesce to 0 so CASE still runs

---

## 3. Guest / User Segmentation

### What It Does
- Segments by guest profile, device, value tier, returning vs new
- Uses **sessions** table only

### Data Sources (sessions table)
| Segment | Column(s) | Example Values |
|---------|-----------|----------------|
| family | guest_segment | 'family_with_young_kids' |
| luxury | guest_segment | 'luxury' (if present) |
| couple | guest_segment | 'couples' |
| business | guest_segment | 'business' |
| returning | is_returning_visitor | true |
| new | is_returning_visitor | false |
| mobile | device_type | 'mobile' |
| desktop | device_type | 'desktop' |
| high_value | potential_revenue, conversion_value | >= 1500 |
| price_sensitive | price_sensitivity_score | > 0.7 |
| other | fallback | - |

### Canonical guest_segment Values (from your DB)
- family_with_young_kids, couples, family_with_teens, large_groups, day_pass_only, season_pass_seekers  
- **Note**: "luxury" and "business" may not exist in your data; segments will show 0 if absent

---

## 4. ClickHouse Schema Additions (If Needed)

### Option A: Add traffic_source to raw_events (for event-based group_by)
```sql
ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS traffic_source String DEFAULT '';
-- Backfill from utm_source: UPDATE raw_events SET traffic_source = utm_source WHERE utm_source != '';
```

### Option B: Use sessions for group_by (recommended)
- Event-based breakdown: **JOIN sessions** when group_by in {traffic_source, guest_segment}
- Ensures consistency with Funnel and other analytics

### Sessions Table – Already Has
All required columns for Behavioral and Guest modes. No schema changes needed if sessions pipeline populates: intent_score, friction_score, urgency_score, price_sensitivity_score, guest_segment, device_type, traffic_source, is_returning_visitor, conversion_value, potential_revenue.

---

## 5. Professional Metrics to Add

| Metric | Description |
|--------|-------------|
| Total addressable | Total unique users/sessions in period (denominator for %) |
| % of total | Each segment’s share of total sessions |
| Conversion rate | conversions / sessions |
| Avg. revenue per session | revenue / sessions (including non-converters) |
| YoY / WoW change | If historical data exists |
| Empty state messaging | Clear "No data" when filters return nothing |

---

## 6. Implementation Checklist

- [x] Document data requirements
- [x] Fix event-based: group_by with sessions JOIN for traffic_source, guest_segment, device_type, browser
- [x] Fix event-based: interval (day/week/month) in time_series
- [x] Fix event-based: divide-by-zero in average, revenue_per_user
- [x] Enhance Behavioral/Guest: add total sessions, % of total, better formatting
- [x] UI: total sessions bar, pct_of_total on cards, safer trend calculation

## 7. Backfilling traffic_source (If Sessions Lack It)

If `sessions.traffic_source` is empty, backfill from `raw_events.utm_source`:

```sql
-- Run a batch job that joins sessions with raw_events and updates traffic_source
-- Example: UPDATE sessions s SET traffic_source = (SELECT utm_source FROM raw_events WHERE session_id = s.session_id LIMIT 1) WHERE traffic_source = '';
```

Or add a pipeline step that copies utm_source → traffic_source when sessions are created.
