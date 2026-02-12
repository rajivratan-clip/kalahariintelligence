# Hybrid Funnel Engine — Architecture

## Overview

The funnel system operates in two modes:

| Mode | Use Case | Event Source | Stability |
|------|----------|--------------|-----------|
| **Demo** | Investor demos, stable UX | Curated config | High |
| **Dynamic** | Ad-hoc analysis, new events | `raw_events` DB | Schema-agnostic |

---

## Layer Separation

### 1. Funnel Definition Layer
- **Location**: `config/funnel_config.py`, `engines/funnel_engine.py`
- **Responsibility**: Resolve steps from mode
  - Demo + empty steps → Load from `DEMO_FUNNEL_STEPS`
  - Demo + provided steps → Use provided (backward compat)
  - Dynamic → Use steps built from `/api/funnel/events/dynamic`
- **Output**: List of `FunnelStepRequest`-compatible dicts

### 2. Query Builder Layer
- **Location**: `api.py` — `map_ui_to_sql`, `build_windowfunnel_conditions`
- **Responsibility**: Convert step definitions to ClickHouse conditions
  - Hospitality: `funnel_step = N`
  - Generic / Dynamic: `event_type = 'value'`
  - Filters: `build_filter_condition()`
- **Output**: `windowFunnel(...)` condition string

### 3. Execution Layer
- **Location**: `api.py` — `get_funnel_data`
- **Responsibility**: Build and run ClickHouse SQL
  - `windowFunnel(window_seconds)(timestamp, condition1, condition2, ...)`
  - GROUP BY session_id
  - Aggregate counts per funnel_level
- **Output**: Step counts, conversion rates, revenue at risk

### 4. Validation Layer
- **Location**: `engines/funnel_engine.py` — `validate_funnel_results`
- **Responsibility**: Detect aggregation drift
  - Step N ≤ Step N-1
  - Step 1 ≤ total sessions (when available)
- **Output**: `(is_valid, anomalies[])`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/funnel` | POST | Main funnel data (supports mode) |
| `/api/funnel/events/dynamic` | GET | Discover event types from DB (cached 5 min) |
| `/api/funnel/demo-config` | GET | Curated demo funnel definitions |
| `/api/funnel/over-time` | POST | Funnel over time |
| `/api/funnel/latency` | POST | Step-to-step latency |
| `/api/funnel/path-analysis` | POST | Path analysis |
| ... | ... | (other funnel endpoints unchanged) |

---

## Request Schema

```json
{
  "steps": [...],
  "funnel_mode": "demo",
  "funnel_id": "hospitality_booking",
  "completed_within": 1,
  "counting_by": "unique_users",
  ...
}
```

- **funnel_mode**: `"demo"` (default) | `"dynamic"`
- **funnel_id**: Optional; used when `funnel_mode=demo` and steps empty (default: `hospitality_booking`)

---

## Sequential Validation

`windowFunnel` enforces strict order:
- Session qualifies for step N only if `MIN(ts_N) > MIN(ts_N-1)` within window
- One count per session per funnel level (no duplicate conversion inflation)
- Conversion rate = `distinct_sessions_stepN / distinct_sessions_stepN-1`

---

## Demo Mode Steps (Curated)

| Step | Label | Maps To |
|------|-------|---------|
| 1 | Landed | funnel_step = 1 |
| 2 | Location Select | funnel_step = 2 |
| 3 | Date Select | funnel_step = 3 |
| 4 | Room Select | funnel_step = 4 |
| 5 | Payment | funnel_step = 7 |
| 6 | Confirmation | funnel_step = 8 |

---

## Dynamic Mode

1. Call `GET /api/funnel/events/dynamic` to get `event_type` list from `raw_events`
2. User selects events to build funnel
3. POST to `/api/funnel` with `funnel_mode: "dynamic"` and steps like:
   ```json
   {
     "event_category": "generic",
     "event_type": "page_view",
     "label": "Page View"
   }
   ```
4. Query uses `event_type = 'page_view'` directly (no funnel_step)

---

## Backward Compatibility

- **Default**: `funnel_mode=demo`, steps from FunnelLab
- **Empty steps + demo**: Resolve from `funnel_config`
- **Provided steps**: Always use provided (existing behavior)
- **Other funnel endpoints** (over-time, latency, etc.): Still use `request.steps`; can be updated to resolve similarly

---

## Files Changed / Added

| File | Change |
|------|--------|
| `config/funnel_config.py` | New — Demo funnel definitions |
| `engines/funnel_engine.py` | New — Resolve, validate, AI metadata |
| `api.py` | Added mode, resolve, validation, dynamic endpoints |
| `services/funnelService.ts` | Pass funnel_mode, funnel_id to API |
| `components/FunnelLab.tsx` | Mode toggle (Demo/Dynamic), dynamic event picker |
| `types.ts` | Added funnel_mode, funnel_id to FunnelDefinition |
| `docs/HYBRID_FUNNEL_ARCHITECTURE.md` | New — This doc |

---

## Quick Test

```bash
# Demo mode with empty steps (resolves from config)
curl -X POST http://localhost:8000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{"steps":[],"funnel_mode":"demo","completed_within":1}'

# Dynamic events
curl http://localhost:8000/api/funnel/events/dynamic?limit=10

# Demo config
curl http://localhost:8000/api/funnel/demo-config
```
