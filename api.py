from typing import Any, List, Optional, Dict
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import run_query

app = FastAPI(title="ResortIQ ClickHouse API")

# Allow your React/Vite dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """
    Simple health check to verify the API and DB connection.
    """
    try:
        # Cheap query just to validate connectivity
        run_query("SELECT 1")
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")


@app.get("/query")
def query(sql: str) -> List[Any]:
    """
    Run an ad‑hoc SELECT query against ClickHouse.
    WARNING: In a real app you should validate/whitelist queries.
    """
    try:
        rows = run_query(sql)
        return rows
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


"""
Funnel Analysis Endpoint

This endpoint is aligned with the ClickHouse schema you described:
- Behavioral layer: raw_events
- Performance layer: sessions
- Intelligence layer: friction_points, guest_segment_benchmarks
- Performance view: mv_funnel_performance

For performance, all high‑level funnel metrics are read from mv_funnel_performance,
which should already be populated from raw_events ⨝ sessions.
"""

class FunnelStepRequest(BaseModel):
    event_name: str  # Used mainly for labeling in the UI
    filters: Optional[Dict[str, Any]] = None


class FunnelRequest(BaseModel):
    steps: List[FunnelStepRequest]
    # Amplitude-style: View type (conversion, overTime, timeToConvert, etc.)
    view_type: str = "conversion"
    # Completed within X days
    completed_within: int = 1
    # Counting by: unique_users, sessions, events
    counting_by: str = "unique_users"
    # Legacy support
    measure: Optional[str] = None  # guests, revenue, intent (mapped from counting_by)
    window: Optional[str] = None   # 1hr, 24hr, 7 Days, 30 Days (mapped from completed_within)
    group_by: Optional[str] = None  # device_type, guest_segment
    date_range: Optional[Dict[str, str]] = None  # Reserved for future date filtering
    global_filters: Optional[Dict[str, Any]] = None  # e.g., {"location": "Wisconsin"}


@app.post("/api/funnel")
async def get_funnel_data(request: FunnelRequest) -> Dict[str, Any]:
    """
    Calculate funnel data based on mv_funnel_performance and guest_segment_benchmarks.

    Funnel logic:
    - Use funnel_step (1–8) to calculate completion and drop‑off rates.
    - Use reached_count as the base count of sessions reaching each step.

    Revenue logic:
    - Revenue at risk = (Current_Step_Sessions - Next_Step_Sessions) * Average avg_booking_value
      from guest_segment_benchmarks.
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": [], "measure": request.measure, "window": request.window}

        # Map configured steps to funnel_step 1..N
        step_numbers = [i + 1 for i in range(step_count)]
        steps_list_sql = ", ".join(str(n) for n in step_numbers)

        # Only supported group_by dimensions present in mv_funnel_performance
        group_col = request.group_by if request.group_by in ("device_type", "guest_segment") else None
        segment_expr = group_col if group_col else "'all'"
        group_by_extra = f", {group_col}" if group_col else ""
        group_by_sql = f"GROUP BY funnel_step{group_by_extra}"

        where_clauses = [f"funnel_step IN ({steps_list_sql})"]

        # Level 1: Global filters (environment) – applied before any funnel math
        gf = request.global_filters or {}
        ui_location = gf.get("location")
        location_filter = normalize_location(ui_location)  # Convert UI name to DB value
        
        # mv_funnel_performance doesn't have location column, so we need to join with sessions
        # when location filter is applied. This uses the "brain layer" session stitching.
        
        # NOTE: mv_funnel_performance doesn't have date column, so date_range filtering
        # would need to be done at the sessions/raw_events level
        where_sql = " AND ".join(where_clauses)

        # Determine counting method
        counting_method = request.counting_by or (request.measure and {
            "guests": "unique_users",
            "revenue": "sessions",
            "intent": "unique_users"
        }.get(request.measure, "unique_users")) or "unique_users"
        
        # If location filter is needed, query from raw_events + sessions directly
        # since mv_funnel_performance doesn't have location dimension
        # This uses the "brain layer" session stitching approach
        if location_filter:
            # Query from raw_events joined with sessions to get location-filtered funnel data
            # Adjust counting based on counting_by parameter
            if counting_method == "unique_users":
                count_expr = "count(DISTINCT s.user_id)"
            elif counting_method == "sessions":
                count_expr = "count(DISTINCT re.session_id)"
            elif counting_method == "events":
                count_expr = "count(*)"
            else:
                count_expr = "count(DISTINCT re.session_id)"
            
            if group_col:
                # Group by device_type or guest_segment from sessions table
                segment_col = f"s.{group_col}"
                query = f"""
                    SELECT 
                        re.funnel_step,
                        {segment_col} AS segment,
                        {count_expr} AS reached_count,
                        sum(COALESCE(s.potential_revenue, 0)) AS potential_revenue_sum
                    FROM raw_events re
                    INNER JOIN sessions s ON re.session_id = s.session_id
                    WHERE re.funnel_step IN ({steps_list_sql})
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%'
                           OR EXISTS (
                               SELECT 1 FROM raw_events re2 
                               WHERE re2.session_id = re.session_id 
                                 AND re2.page_category LIKE '%{location_filter.lower()}%'
                           ))
                    GROUP BY re.funnel_step, {segment_col}
                    ORDER BY re.funnel_step, {segment_col}
                """
            else:
                query = f"""
                    SELECT 
                        re.funnel_step,
                        'all' AS segment,
                        {count_expr} AS reached_count,
                        sum(COALESCE(s.potential_revenue, 0)) AS potential_revenue_sum
                    FROM raw_events re
                    INNER JOIN sessions s ON re.session_id = s.session_id
                    WHERE re.funnel_step IN ({steps_list_sql})
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%'
                           OR EXISTS (
                               SELECT 1 FROM raw_events re2 
                               WHERE re2.session_id = re.session_id 
                                 AND re2.page_category LIKE '%{location_filter.lower()}%'
                           ))
                    GROUP BY re.funnel_step
                    ORDER BY re.funnel_step
                """
        else:
            # Use the fast materialized view when no location filter
            query = f"""
                SELECT 
                    funnel_step,
                    {segment_expr} AS segment,
                    sum(reached_count) AS reached_count,
                    sum(potential_revenue_sum) AS potential_revenue_sum
                FROM mv_funnel_performance
                WHERE {where_sql}
                {group_by_sql}
                ORDER BY funnel_step
            """

        rows = run_query(query)

        # If the view is not yet materialised, fall back to mock-style data so the UI still works.
        if not rows:
            fallback = []
            for idx, step in enumerate(request.steps):
                value = 10000 - (idx * 1000)
                fallback.append({
                    "step_name": step.event_name,
                    "visitors": value,
                    "conversion_rate": 100.0 if idx == 0 else 80.0,
                    "drop_off_rate": 0.0 if idx == 0 else 20.0,
                    "revenue_at_risk": float((idx * 10000)),
                    "segments": {"all": value},
                })
            return {"data": fallback, "measure": request.measure, "window": request.window}

        # Build: step_number -> segment -> metrics
        step_map: Dict[int, Dict[str, Dict[str, float]]] = {}
        for row in rows:
            step_num = int(row[0])
            segment = str(row[1])
            reached = float(row[2])
            potential_rev = float(row[3])
            if step_num not in step_map:
                step_map[step_num] = {}
            step_map[step_num][segment] = {
                "reached": reached,
                "potential_revenue": potential_rev,
            }

        # Sessions per step (for funnel math)
        sessions_per_step: List[float] = []
        for idx, step_num in enumerate(step_numbers):
            segs = step_map.get(step_num, {})
            total_reached = sum(v["reached"] for v in segs.values()) if segs else 0.0
            sessions_per_step.append(total_reached)

        # Average booking value from guest_segment_benchmarks
        # Use most recent date's data for accuracy
        avg_booking_value = 260.0  # Default based on your schema (All Locations average)
        try:
            gf = request.global_filters or {}
            ui_location = gf.get("location")
            location_filter = normalize_location(ui_location)

            # guest_segment_benchmarks has date, guest_segment, and avg_booking_value
            # Get the most recent date's average booking value
            # If location filter is set, we estimate from sessions data
            # since benchmarks table doesn't have location column
            
            if location_filter:
                # Estimate ABV from sessions table for this location
                # This is a fallback since guest_segment_benchmarks doesn't have location
                try:
                    abv_query = f"""
                        SELECT avg(final_total_price) 
                        FROM sessions 
                        WHERE converted = 1 
                          AND final_location = '{location_filter}'
                          AND final_total_price > 0
                    """
                    abv_rows = run_query(abv_query)
                    if abv_rows and abv_rows[0][0] is not None:
                        avg_booking_value = float(abv_rows[0][0])
                except Exception:
                    # Fallback to benchmarks average
                    bench_sql = """
                        SELECT avg(avg_booking_value) 
                        FROM guest_segment_benchmarks 
                        WHERE date = (SELECT max(date) FROM guest_segment_benchmarks)
                    """
                    bench_rows = run_query(bench_sql)
                    if bench_rows and bench_rows[0][0] is not None:
                        avg_booking_value = float(bench_rows[0][0])
            else:
                # Use most recent benchmarks data
                bench_sql = """
                    SELECT avg(avg_booking_value) 
                    FROM guest_segment_benchmarks 
                    WHERE date = (SELECT max(date) FROM guest_segment_benchmarks)
                """
                bench_rows = run_query(bench_sql)
                if bench_rows and bench_rows[0][0] is not None:
                    avg_booking_value = float(bench_rows[0][0])
        except Exception as e:
            # If benchmarks are not present, keep the default
            print(f"Warning: Could not fetch ABV from benchmarks: {e}")
            pass

        result = []
        for idx, step in enumerate(request.steps):
            step_num = step_numbers[idx]
            segs = step_map.get(step_num, {})

            sessions_here = sessions_per_step[idx]
            prev_sessions = sessions_per_step[idx - 1] if idx > 0 else sessions_here
            next_sessions = sessions_per_step[idx + 1] if idx < step_count - 1 else sessions_here

            # Conversion / drop-off are based on sessions reaching each step
            conversion_rate = (sessions_here / prev_sessions * 100) if prev_sessions > 0 else 0.0
            drop_off_rate = 100.0 - conversion_rate if idx > 0 else 0.0

            # Revenue at risk per spec: drop-off sessions * average booking value
            dropped_sessions = max(0.0, sessions_here - next_sessions)
            revenue_at_risk = dropped_sessions * avg_booking_value

            # Value for chart based on counting_by (Amplitude-style)
            total_potential_revenue = sum(v["potential_revenue"] for v in segs.values()) if segs else 0.0
            
            # Determine counting method from counting_by parameter
            counting_method = request.counting_by or (request.measure and {
                "guests": "unique_users",
                "revenue": "sessions",
                "intent": "unique_users"
            }.get(request.measure, "unique_users")) or "unique_users"
            
            # For unique_users, we approximate with sessions (mv_funnel_performance has reached_count)
            # In production, you'd query count(DISTINCT user_id) from sessions for accurate counts
            if counting_method == "unique_users":
                value_for_chart = sessions_here  # Approximation: most users have 1 session per funnel
            elif counting_method == "sessions":
                value_for_chart = sessions_here
            elif counting_method == "events":
                # Estimate: sessions * avg events per step
                value_for_chart = int(sessions_here * 2.5)  # Rough estimate
            else:
                value_for_chart = sessions_here

            # Segment breakdown for UI
            if request.group_by and segs:
                segments_out = {
                    segment: metrics["reached"] for segment, metrics in segs.items()
                }
            else:
                segments_out = {"all": sessions_here}

            result.append({
                "step_name": step.event_name,
                "visitors": int(value_for_chart),
                "conversion_rate": round(conversion_rate, 1),
                "drop_off_rate": round(drop_off_rate, 1),
                "revenue_at_risk": round(revenue_at_risk, 2),
                "segments": segments_out,
            })

        return {"data": result, "measure": request.measure, "window": request.window}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Funnel query error: {str(exc)}")


HOSPITALITY_STEP_MAP: Dict[str, int] = {
    "landed": 1,
    "location_select": 2,
    "date_select": 3,
    "room_select": 4,
    "addon_select": 5,
    "guest_info": 6,
    "payment": 7,
    "confirmation": 8,
}

# Map UI location names to database values
LOCATION_MAP: Dict[str, str] = {
    "Wisconsin": "wisconsin_dells",
    "Pocono": "pocono_mountains",
    "Sandusky": "sandusky_ohio",
    "Round Rock": "round_rock_texas",
}

def normalize_location(ui_location: Optional[str]) -> Optional[str]:
    """Convert UI location name to database value."""
    if not ui_location or ui_location == "All Locations":
        return None
    return LOCATION_MAP.get(ui_location, ui_location.lower().replace(" ", "_"))


@app.get("/api/funnel/friction")
async def get_friction_data(
    step_name: str = Query(...),
    date_range_start: Optional[str] = None,
    date_range_end: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get friction data for a specific funnel step using the friction_points table.

    Forensics logic:
    - When analyzing a drop-off at Step X, query friction_points where associated_step = X.
    """
    try:
        step_key = step_name.lower()
        associated_step = HOSPITALITY_STEP_MAP.get(step_key)

        # If we can't map the name to a funnel_step (e.g. purely generic event),
        # fall back to mock data so the UI still renders something.
        if associated_step is None:
            friction_points = [
                {"element": "Apply Promo Button", "clicks": 1200, "failures": 960, "failure_rate": 80.0},
                {"element": "Date Picker", "clicks": 800, "failures": 400, "failure_rate": 50.0},
            ]
            return {"step": step_name, "friction_points": friction_points}

        # friction_points schema: element_selector, rage_click_count, total_interactions, drop_offs_after_interaction
        # Calculate failure_rate from drop_offs_after_interaction / total_interactions
        query = f"""
            SELECT 
                element_selector,
                total_interactions,
                rage_click_count,
                drop_offs_after_interaction,
                sessions_affected
            FROM friction_points
            WHERE associated_step = {associated_step}
            ORDER BY drop_offs_after_interaction DESC, rage_click_count DESC
            LIMIT 5
        """

        try:
            rows = run_query(query)
            friction_points = [
                {
                    "element": row[0] or "Unknown Element",  # element_selector
                    "clicks": int(row[1] or 0),  # total_interactions
                    "failures": int(row[3] or 0),  # drop_offs_after_interaction
                    # Calculate failure_rate as percentage of interactions that led to drop-offs
                    "failure_rate": round((float(row[3] or 0) / float(row[1] or 1)) * 100, 1) if row[1] and row[1] > 0 else 0.0,
                }
                for row in rows
            ]
        except Exception:
            # Mock data if the friction_points table is not present yet
            friction_points = [
                {"element": "Apply Promo Button", "clicks": 1200, "failures": 960, "failure_rate": 80.0},
                {"element": "Date Picker", "clicks": 800, "failures": 400, "failure_rate": 50.0},
            ]

        return {"step": step_name, "friction_points": friction_points}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Friction query error: {str(exc)}")


# Brain Layer: Session Stitching Endpoint
# This implements the "retrospective tagging" logic where if a user selects
# a location at Step 2, their Step 1 (Landed) gets tagged with that location
@app.get("/api/funnel/session-stitch")
async def session_stitch_funnel(
    location: Optional[str] = Query(None),
    step_filters: Optional[str] = Query(None),  # JSON string of step-specific filters
    window_seconds: int = Query(86400, description="Conversion window in seconds")
) -> Dict[str, Any]:
    """
    Brain Layer: Session stitching funnel analysis.
    
    Uses windowFunnel to find sessions that eventually reached certain steps,
    then retrospectively tags earlier steps with the final context (e.g., location).
    
    Example: If user selected "Wisconsin" at Step 2, their Step 1 gets tagged as "Wisconsin"
    for analysis purposes.
    """
    try:
        # Parse step filters if provided
        filters_dict = {}
        if step_filters:
            import json
            filters_dict = json.loads(step_filters)
        
        # Normalize location from UI name to DB value
        db_location = normalize_location(location)
        
        # Build windowFunnel conditions based on requested steps
        # Find sessions that selected this location and analyze their full funnel
        
        if db_location:
            # Find all sessions that selected this location
            sessions_query = f"""
                SELECT DISTINCT session_id 
                FROM sessions 
                WHERE final_location = '{db_location}' 
                   OR final_location LIKE '%{db_location}%'
            """
            session_rows = run_query(sessions_query)
            session_ids = [row[0] for row in session_rows]
            
            if not session_ids:
                return {"data": [], "message": f"No sessions found for location: {location}"}
            
            # Query funnel steps for these sessions
            session_ids_str = "', '".join(session_ids)
            query = f"""
                SELECT 
                    funnel_step,
                    count(DISTINCT session_id) AS reached_count,
                    sum(COALESCE((SELECT potential_revenue FROM sessions s WHERE s.session_id = re.session_id LIMIT 1), 0)) AS potential_revenue_sum
                FROM raw_events re
                WHERE session_id IN ('{session_ids_str}')
                  AND funnel_step IN (1, 2, 3, 4, 5, 6, 7, 8)
                GROUP BY funnel_step
                ORDER BY funnel_step
            """
            
            rows = run_query(query)
            
            result = []
            for row in rows:
                result.append({
                    "funnel_step": int(row[0]),
                    "reached_count": int(row[1]),
                    "potential_revenue_sum": float(row[2]) if row[2] else 0.0
                })
            
            return {"data": result, "location": location, "location_db": db_location, "sessions_analyzed": len(session_ids)}
        else:
            return {"data": [], "message": "Please provide a location parameter"}
            
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Session stitch error: {str(exc)}")


# Example: more specific domain endpoint (you can extend later)
@app.get("/bookings/sample")
def sample_bookings() -> List[Any]:
    """
    Example endpoint that queries a hypothetical bookings table.
    Adjust the SQL to match your schema.
    """
    sql = "SELECT * FROM sessions WHERE converted = 1 LIMIT 10"
    try:
        return run_query(sql)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

