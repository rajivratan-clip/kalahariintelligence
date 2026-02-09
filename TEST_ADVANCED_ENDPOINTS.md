# Testing Advanced Analytics Endpoints

## 🧪 Quick Test Commands

### Prerequisites
Ensure the backend is running:
```bash
cd /home/rajivratan/Downloads/resortiq---hospitality-intelligence
source /home/rajivratan/ai/bin/activate
uvicorn api:app --reload --port 8000 --env-file .env
```

---

## 1️⃣ Test Cohort Analysis

**What it tests:** Recovery rates, first-time vs returning visitors using `is_returning_visitor` column

```bash
curl -X POST http://localhost:8000/api/funnel/cohort-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {"event_type": "Landed", "label": "Landed"},
      {"event_type": "Location Select", "label": "Location Select"},
      {"event_type": "Date Select", "label": "Date Select"},
      {"event_type": "Room Select", "label": "Room Select"},
      {"event_type": "Payment", "label": "Payment"},
      {"event_type": "Confirmation", "label": "Confirmation"}
    ],
    "completed_within": 1,
    "global_filters": null
  }' | python -m json.tool
```

**Expected Response:**
```json
{
  "data": [
    {
      "step_name": "Landed",
      "step_index": 1,
      "total_dropped": 150,
      "recovered": 12,
      "recovery_rate": 8.0,
      "avg_days_to_rebook": 5.3,
      "first_time_count": 120,
      "returning_count": 30
    },
    ...
  ]
}
```

**Error Behavior:**
- ❌ If `is_returning_visitor` column doesn't exist → HTTP 500 with error message
- ✅ Proper error (not silent empty data)

---

## 2️⃣ Test Executive Summary

**What it tests:** Top 3 revenue leaks using `mv_funnel_performance` materialized view

```bash
# Test without location filter
curl -X GET "http://localhost:8000/api/funnel/executive-summary?days=30" | python -m json.tool

# Test with location filter
curl -X GET "http://localhost:8000/api/funnel/executive-summary?days=30&location=Sandusky" | python -m json.tool
```

**Expected Response:**
```json
{
  "total_revenue_lost": 125450.50,
  "top_3_leaks": [
    {
      "step": 4,
      "reached": 5000,
      "dropped": 1200,
      "dropoff_rate": 24.0,
      "revenue_lost": 78000.00
    },
    {
      "step": 5,
      "reached": 3800,
      "dropped": 800,
      "dropoff_rate": 21.1,
      "revenue_lost": 32450.50
    },
    {
      "step": 3,
      "reached": 6500,
      "dropped": 500,
      "dropoff_rate": 7.7,
      "revenue_lost": 15000.00
    }
  ],
  "period_days": 30,
  "location": "Sandusky"
}
```

**Error Behavior:**
- ❌ If `mv_funnel_performance` table doesn't exist → HTTP 500 with error message
- ✅ Proper error (not silent empty data)
- ✅ Location filtering works on materialized view

---

## 3️⃣ Test in Frontend

### Via Funnel Lab UI:

1. **Start Frontend:**
```bash
cd /home/rajivratan/Downloads/resortiq---hospitality-intelligence
npm run dev
```

2. **Navigate to:** http://localhost:3000

3. **Test Cohort Analysis Tab:**
   - Open Funnel Lab
   - Click on "Cohort Analysis" tab
   - Should see recovery rates, first-time vs returning breakdown
   - If empty data → check backend logs for query errors

4. **Test Executive Summary Tab:**
   - Click on "Executive Summary" tab
   - Should see top 3 revenue leaks with proper metrics
   - Try changing location filter to verify filtering works

---

## 🐛 Debugging

### Check ClickHouse Schema:

```sql
-- Verify is_returning_visitor column exists
DESCRIBE TABLE raw_events;

-- Verify mv_funnel_performance exists
SHOW TABLES LIKE 'mv_funnel_performance';

-- Check data in materialized view
SELECT 
    funnel_step, 
    count(*) as records,
    sum(reached_count) as total_reached,
    sum(dropped_count) as total_dropped
FROM mv_funnel_performance
WHERE date >= today() - 30
GROUP BY funnel_step
ORDER BY funnel_step;
```

### Backend Logs:

```bash
# Watch backend logs for errors
tail -f /home/rajivratan/Downloads/resortiq---hospitality-intelligence/logs/api.log

# Or if using uvicorn directly, watch console output
```

---

## ✅ Success Criteria

Both endpoints should:
- ✅ Return real data (not empty arrays)
- ✅ Raise HTTP 500 errors if schema is missing (not silent failures)
- ✅ Apply location filters correctly
- ✅ Show proper metrics in frontend UI tabs
- ✅ Backend logs show successful query execution

---

## 📊 Performance Notes

**Executive Summary** is now optimized:
- Uses pre-aggregated `mv_funnel_performance` instead of raw scans
- Location filtering happens on materialized view (faster)
- Revenue calculations use pre-computed `total_revenue_at_risk` column

**Cohort Analysis** still scans raw_events:
- Recovery rate calculations require session-level CTEs
- First-time/returning breakdown now uses indexed `is_returning_visitor` column
- Consider adding materialized view for cohort metrics if performance becomes an issue
