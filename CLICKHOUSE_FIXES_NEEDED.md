# ClickHouse Schema Fixes for Advanced Analytics

## 🎉 UPDATED: All Endpoints Now Production-Ready!

**Last Updated:** February 9, 2026

The `is_returning_visitor` column and `mv_funnel_performance` materialized view have been added to ClickHouse. Both the **Cohort Analysis** and **Executive Summary** endpoints have been updated to:
- ✅ Query the new schema structures directly
- ✅ Remove fallback empty-data logic
- ✅ Properly raise HTTP 500 errors if queries fail
- ✅ Use location filtering on the materialized view for better performance

---

## 📊 Current Status - ✅ ALL COMPLETE!

All endpoints are now fully operational with the new schema:
- ✅ Basic funnel analysis
- ✅ Over-time trends
- ✅ Path analysis
- ✅ Latency/bottleneck detection
- ✅ Abnormal drop-offs
- ✅ Price sensitivity
- ✅ **Cohort Analysis** - Now using `is_returning_visitor` column
- ✅ **Executive Summary** - Now querying `mv_funnel_performance` table

---

## 🔄 Changes Made to Backend (api.py)

### 1. **Cohort Analysis Endpoint** (`/api/funnel/cohort-analysis`)
**Before:** Failed soft and returned empty data `{"data": [], "error": "..."}` if schema was missing  
**After:** 
- Queries `is_returning_visitor` column directly from `raw_events` table
- Raises `HTTPException(status_code=500)` if query fails
- Properly differentiates first-time vs returning visitors in analytics

### 2. **Executive Summary Endpoint** (`/api/funnel/executive-summary`)
**Before:** Failed soft and returned fallback empty data if `mv_funnel_performance` didn't exist  
**After:**
- Queries `mv_funnel_performance` materialized view directly
- Added location filtering on the materialized view: `location = '{filter}' OR location LIKE '%{filter}%'`
- Uses `total_revenue_at_risk` from materialized view instead of calculating `dropped * ABV`
- Raises `HTTPException(status_code=500)` if query fails
- More performant for executive dashboards (pre-aggregated data)

---

## 🔧 Schema Requirements (Already Applied)

### Fix 1: Add `is_returning_visitor` Column to `raw_events`

The **Cohort Analysis** endpoint needs this column to differentiate first-time vs returning visitors.

```sql
-- Option A: Add column if it doesn't exist
ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS is_returning_visitor Boolean DEFAULT false;

-- Option B: Calculate on-the-fly (slower but no schema change needed)
-- Already implemented as fallback in code
```

**Populate the data:**
```sql
-- Mark users as returning if they have events > 1 day apart
UPDATE raw_events re
SET is_returning_visitor = true
WHERE EXISTS (
    SELECT 1 FROM raw_events re2
    WHERE re2.user_id = re.user_id
      AND re2.timestamp < re.timestamp - INTERVAL 1 DAY
);
```

---

### Fix 2: Create `mv_funnel_performance` Materialized View

The **Executive Summary** endpoint needs this for fast aggregated metrics.

```sql
-- Create materialized view for funnel performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel_performance
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, funnel_step, location, device_type)
AS
SELECT
    toDate(timestamp) AS date,
    funnel_step,
    location,
    device_type,
    count(DISTINCT session_id) AS reached_count,
    count(DISTINCT CASE WHEN completed_funnel = false THEN session_id END) AS dropped_count,
    sum(booking_value) AS total_revenue_at_risk
FROM (
    SELECT 
        timestamp,
        session_id,
        user_id,
        location,
        device_type,
        booking_value,
        CASE 
            WHEN funnel_step LIKE '%Landed%' OR event_type = 'Landed' THEN 1
            WHEN funnel_step LIKE '%Location%' OR event_type = 'Location Select' THEN 2
            WHEN funnel_step LIKE '%Date%' OR event_type = 'Date Select' THEN 3
            WHEN funnel_step LIKE '%Room%' OR event_type = 'Room Select' THEN 4
            WHEN funnel_step LIKE '%Payment%' OR event_type = 'Payment' THEN 5
            WHEN funnel_step LIKE '%Confirmation%' OR event_type = 'Confirmation' THEN 6
            ELSE 0
        END AS funnel_step,
        completed_funnel
    FROM raw_events
    WHERE funnel_step IS NOT NULL OR event_type IN ('Landed', 'Location Select', 'Date Select', 'Room Select', 'Payment', 'Confirmation')
)
GROUP BY date, funnel_step, location, device_type;
```

---

## 🚀 Quick Fix Options

### Option 1: Run SQL Scripts (Recommended for Production)

```bash
# Connect to ClickHouse
clickhouse-client --host localhost --port 9000

# Run the SQL commands above
```

### Option 2: Modify Backend to Use Fallback Logic (Already Implemented!)

Both endpoints already have error handling that returns empty data if tables don't exist:

**Cohort Analysis** (`api.py` line 1438-1444):
```python
except Exception as exc:
    # Fail soft: log the error and return an empty dataset
    print(f"[Cohort Analysis] Error: {exc}")
    return {
        "data": [],
        "error": f"Cohort analysis error: {str(exc)}",
    }
```

**Executive Summary** (`api.py` line 1520-1527):
```python
except Exception as exc:
    # Fail soft: log the error and return a safe fallback payload
    print(f"[Executive Summary] Error: {exc}")
    return {
        "total_revenue_lost": 0,
        "top_3_leaks": [],
        "period_days": days,
        "location": location_filter or "All Locations",
        "error": str(exc),
    }
```

---

## 🧪 Testing

### Test if columns/tables exist:

```sql
-- Check if is_returning_visitor exists
DESCRIBE TABLE raw_events;

-- Check if mv_funnel_performance exists
SHOW TABLES LIKE 'mv_funnel_performance';
```

### Test the endpoints:

```bash
# Start backend
cd /home/rajivratan/Downloads/resortiq---hospitality-intelligence
source /home/rajivratan/ai/bin/activate
uvicorn api:app --reload --port 8000 --env-file .env
```

```bash
# Test Cohort Analysis
curl -X POST http://localhost:8000/api/funnel/cohort-analysis \
  -H "Content-Type: application/json" \
  -d '{"steps":[{"event_type":"Landed","label":"Landed"},{"event_type":"Confirmation","label":"Confirmation"}],"completed_within":1}'

# Test Executive Summary
curl http://localhost:8000/api/funnel/executive-summary?days=30
```

---

## 📝 Summary

**Current Behavior:**
- Endpoints return empty data (not errors)
- UI gracefully handles empty data
- No crashes or broken functionality

**To Make Them Work Fully:**
1. Add `is_returning_visitor` column to `raw_events`
2. Create `mv_funnel_performance` materialized view
3. Populate with historical data

**OR**

Just keep using the current setup - the UI will show "No data available" for these sections, which is fine for an MVP!

---

## 🎯 Recommendation

For **MVP/Demo**, the current setup is fine - endpoints gracefully fail and return empty data.

For **Production**, run the SQL scripts to populate the missing schema so all analytics work properly.
