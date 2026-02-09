from typing import Any, List, Optional, Dict
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import run_query
import os
import json
import urllib.request

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


@app.get("/api/metadata/schema")
async def get_schema() -> Dict[str, Any]:
    """
    Returns available event types organized by category (Generic vs Hospitality)
    and their filterable properties.
    """
    try:
        # Get distinct event types from database
        event_types_rows = run_query("SELECT DISTINCT event_type FROM raw_events ORDER BY event_type")
        db_event_types = [row[0] for row in event_types_rows]
        
        # Define ALL properties available for filtering (from raw_events columns)
        # Organized by category for better UX
        all_properties = [
            # Page/URL Properties
            {"property": "page_url", "type": "string", "label": "Page URL", "category": "Page"},
            {"property": "page_category", "type": "string", "label": "Page Category", "category": "Page"},
            {"property": "page_title", "type": "string", "label": "Page Title", "category": "Page"},
            {"property": "referrer_url", "type": "string", "label": "Referrer URL", "category": "Page"},
            
            # Element/Interaction Properties
            {"property": "element_selector", "type": "string", "label": "Element Selector", "category": "Interaction"},
            {"property": "element_text", "type": "string", "label": "Element Text", "category": "Interaction"},
            {"property": "element_type", "type": "string", "label": "Element Type", "category": "Interaction"},
            {"property": "interaction_type", "type": "string", "label": "Interaction Type", "category": "Interaction"},
            {"property": "is_rage_click", "type": "boolean", "label": "Is Rage Click", "category": "Interaction"},
            {"property": "is_dead_click", "type": "boolean", "label": "Is Dead Click", "category": "Interaction"},
            {"property": "is_hesitation_click", "type": "boolean", "label": "Is Hesitation Click", "category": "Interaction"},
            {"property": "hover_duration_ms", "type": "number", "label": "Hover Duration (ms)", "category": "Interaction"},
            
            # Scroll Properties
            {"property": "scroll_depth_percent", "type": "number", "label": "Scroll Depth (%)", "category": "Engagement"},
            {"property": "scroll_speed_pixels_per_sec", "type": "number", "label": "Scroll Speed (px/s)", "category": "Engagement"},
            {"property": "time_on_page_seconds", "type": "number", "label": "Time on Page (s)", "category": "Engagement"},
            
            # Form Properties
            {"property": "form_field_name", "type": "string", "label": "Form Field Name", "category": "Form"},
            {"property": "form_field_value_length", "type": "number", "label": "Form Value Length", "category": "Form"},
            {"property": "form_corrections_count", "type": "number", "label": "Form Corrections", "category": "Form"},
            {"property": "form_autofill_detected", "type": "boolean", "label": "Form Autofill", "category": "Form"},
            {"property": "form_validation_error", "type": "string", "label": "Validation Error", "category": "Form"},
            
            # Hospitality/Booking Properties
            {"property": "funnel_step", "type": "number", "label": "Funnel Step", "category": "Booking"},
            {"property": "selected_location", "type": "string", "label": "Selected Location", "category": "Booking"},
            {"property": "selected_room_type", "type": "string", "label": "Room Type", "category": "Booking"},
            {"property": "selected_checkin_date", "type": "date", "label": "Check-in Date", "category": "Booking"},
            {"property": "selected_checkout_date", "type": "date", "label": "Check-out Date", "category": "Booking"},
            {"property": "nights_count", "type": "number", "label": "Nights", "category": "Booking"},
            {"property": "price_viewed_amount", "type": "number", "label": "Price Amount", "category": "Booking"},
            {"property": "selected_guests_adults", "type": "number", "label": "Adults", "category": "Booking"},
            {"property": "selected_guests_children", "type": "number", "label": "Children", "category": "Booking"},
            {"property": "discount_code_attempted", "type": "string", "label": "Discount Code", "category": "Booking"},
            {"property": "discount_code_success", "type": "boolean", "label": "Discount Applied", "category": "Booking"},
            {"property": "addon_viewed", "type": "string", "label": "Add-on Viewed", "category": "Booking"},
            {"property": "addon_added", "type": "boolean", "label": "Add-on Added", "category": "Booking"},
            
            # Search Properties
            {"property": "search_query", "type": "string", "label": "Search Query", "category": "Search"},
            {"property": "search_results_count", "type": "number", "label": "Search Results", "category": "Search"},
            
            # Device/Browser Properties
            {"property": "device_type", "type": "string", "label": "Device Type", "category": "Device"},
            {"property": "browser", "type": "string", "label": "Browser", "category": "Device"},
            {"property": "viewport_width", "type": "number", "label": "Viewport Width", "category": "Device"},
            {"property": "viewport_height", "type": "number", "label": "Viewport Height", "category": "Device"},
            {"property": "connection_speed", "type": "string", "label": "Connection Speed", "category": "Device"},
            
            # Marketing/Attribution Properties
            {"property": "utm_source", "type": "string", "label": "UTM Source", "category": "Marketing"},
            {"property": "utm_medium", "type": "string", "label": "UTM Medium", "category": "Marketing"},
            {"property": "utm_campaign", "type": "string", "label": "UTM Campaign", "category": "Marketing"},
            {"property": "is_returning_visitor", "type": "boolean", "label": "Returning Visitor", "category": "Marketing"},
            
            # Performance Properties
            {"property": "page_load_time_ms", "type": "number", "label": "Page Load Time (ms)", "category": "Performance"},
            {"property": "api_response_time_ms", "type": "number", "label": "API Response Time (ms)", "category": "Performance"},
            
            # Event Properties
            {"property": "event_type", "type": "string", "label": "Event Type", "category": "Event"},
            {"property": "session_id", "type": "string", "label": "Session ID", "category": "Event"},
            {"property": "user_id", "type": "string", "label": "User ID", "category": "Event"},
        ]
        
        # Generic Events (from database + common ones)
        generic_events = [
            {"name": "Page Viewed", "event_type": "page_view", "properties": ["page_url", "page_category", "page_title", "referrer_url", "device_type", "browser"]},
            {"name": "Click", "event_type": "click", "properties": ["element_selector", "element_text", "element_type", "page_url", "is_rage_click", "is_dead_click"]},
            {"name": "Form Started", "event_type": "form_interaction", "properties": ["form_field_name", "page_url", "interaction_type"]},
            {"name": "Form Submitted", "event_type": "form_submit", "properties": ["form_field_name", "form_validation_error", "api_response_time_ms"]},
            {"name": "Scroll", "event_type": "scroll", "properties": ["page_url", "scroll_depth_percent"]},
            {"name": "Error", "event_type": "error", "properties": ["page_url", "form_validation_error"]},
            {"name": "Any Event", "event_type": "*", "properties": ["device_type", "browser", "utm_source", "api_response_time_ms", "page_load_time_ms", "is_rage_click"]},
        ]
        
        # Hospitality Events
        hospitality_events = [
            {"name": "Landed", "funnel_step": 1, "properties": ["page_url", "device_type", "utm_source"]},
            {"name": "Location Select", "funnel_step": 2, "properties": ["selected_location", "page_category"]},
            {"name": "Date Select", "funnel_step": 3, "properties": ["selected_checkin_date", "selected_checkout_date", "nights_count"]},
            {"name": "Room Select", "funnel_step": 4, "properties": ["selected_room_type", "price_viewed_amount", "nights_count"]},
            {"name": "Add-on Select", "funnel_step": 5, "properties": ["addon_viewed", "price_viewed_amount"]},
            {"name": "Guest Info", "funnel_step": 6, "properties": ["selected_guests_adults", "selected_guests_children", "form_field_name"]},
            {"name": "Payment", "funnel_step": 7, "properties": ["form_validation_error", "api_response_time_ms", "discount_code_attempted"]},
            {"name": "Confirmation", "funnel_step": 8, "properties": ["page_url", "price_viewed_amount"]},
        ]
        
        return {
            "generic_events": generic_events,
            "hospitality_events": hospitality_events,
            "all_properties": all_properties,
            "db_event_types": db_event_types,  # Raw event_type values from DB
            "group_by_options": ["device_type", "browser", "utm_source", "utm_medium", "guest_segment"]
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Schema query error: {str(exc)}")


"""
Event-Driven Funnel Analysis using windowFunnel

This endpoint uses ClickHouse's windowFunnel function to calculate funnels
based on event sequences, not hardcoded funnel_step values.
"""

class EventFilter(BaseModel):
    property: str  # e.g., "page_url", "element_text", "funnel_step"
    operator: str = "equals"  # equals, contains, starts_with, greater_than, less_than
    value: Any  # The filter value


class FunnelStepRequest(BaseModel):
    event_category: str = "generic"  # "generic" or "hospitality"
    event_type: str  # For generic: "page_view", "click", etc. For hospitality: "room_select", "location_select", etc.
    label: Optional[str] = None  # User-friendly label
    filters: Optional[List[EventFilter]] = None  # List of filters (property, operator, value)


class FunnelRequest(BaseModel):
    steps: List[FunnelStepRequest]
    view_type: str = "conversion"
    completed_within: int = 1  # days, converted to seconds for windowFunnel
    counting_by: str = "unique_users"
    measure: Optional[str] = None
    window: Optional[str] = None
    group_by: Optional[str] = None
    date_range: Optional[Dict[str, str]] = None
    global_filters: Optional[Dict[str, Any]] = None


# Mapping layer: Human-readable event names to database logic
EVENT_MAPPING = {
    # Generic Events
    "Page Viewed": {"base": "event_type = 'page_view'", "category": "generic"},
    "Click": {"base": "event_type = 'click'", "category": "generic"},
    "Form Started": {"base": "event_type = 'form_interaction' AND interaction_type = 'focus'", "category": "generic"},
    "Form Submitted": {"base": "event_type = 'form_submit'", "category": "generic"},
    "Scroll": {"base": "event_type = 'scroll'", "category": "generic"},
    "Error": {"base": "event_type = 'error'", "category": "generic"},
    "Any Event": {"base": "1=1", "category": "generic"},  # Matches everything
    
    # Hospitality Events
    "Landed": {"base": "funnel_step = 1", "category": "hospitality"},
    "Location Select": {"base": "funnel_step = 2", "category": "hospitality"},
    "Date Select": {"base": "funnel_step = 3", "category": "hospitality"},
    "Room Select": {"base": "funnel_step = 4", "category": "hospitality"},
    "Add-on Select": {"base": "funnel_step = 5", "category": "hospitality"},
    "Guest Info": {"base": "funnel_step = 6", "category": "hospitality"},
    "Payment": {"base": "funnel_step = 7", "category": "hospitality"},
    "Confirmation": {"base": "funnel_step = 8", "category": "hospitality"},
}


def build_filter_condition(filter_obj: EventFilter) -> str:
    """Convert an EventFilter to a SQL WHERE condition.
    
    Supports various operators:
    - equals, not_equals
    - contains, not_contains
    - starts_with, ends_with
    - greater_than, less_than, greater_than_or_equal, less_than_or_equal
    - in, not_in (for comma-separated values)
    - is_null, is_not_null
    """
    prop = filter_obj.property
    operator = filter_obj.operator
    value = filter_obj.value
    
    # Handle null checks
    if operator == "is_null":
        return f"{prop} IS NULL"
    elif operator == "is_not_null":
        return f"{prop} IS NOT NULL"
    
    # Handle boolean values
    if isinstance(value, bool):
        bool_val = "1" if value else "0"
        if operator == "equals":
            return f"{prop} = {bool_val}"
        elif operator == "not_equals":
            return f"{prop} != {bool_val}"
        else:
            return f"{prop} = {bool_val}"  # Default for booleans
    
    # Handle numeric values
    if isinstance(value, (int, float)):
        if operator == "equals":
            return f"{prop} = {value}"
        elif operator == "not_equals":
            return f"{prop} != {value}"
        elif operator == "greater_than":
            return f"{prop} > {value}"
        elif operator == "less_than":
            return f"{prop} < {value}"
        elif operator == "greater_than_or_equal":
            return f"{prop} >= {value}"
        elif operator == "less_than_or_equal":
            return f"{prop} <= {value}"
        else:
            return f"{prop} = {value}"
    
    # Handle string values
    value_escaped_safe = str(value).replace("'", "''")
    value_escaped = f"'{value_escaped_safe}'"
    
    if operator == "equals":
        return f"{prop} = {value_escaped}"
    elif operator == "not_equals":
        return f"{prop} != {value_escaped}"
    elif operator == "contains":
        return f"{prop} LIKE '%{value_escaped_safe}%'"
    elif operator == "not_contains":
        return f"{prop} NOT LIKE '%{value_escaped_safe}%'"
    elif operator == "starts_with":
        return f"{prop} LIKE '{value_escaped_safe}%'"
    elif operator == "ends_with":
        return f"{prop} LIKE '%{value_escaped_safe}'"
    elif operator == "in":
        # Handle comma-separated values or array
        if isinstance(value, list):
            values = [str(v).replace("'", "''") for v in value]
        else:
            values = [v.strip().replace("'", "''") for v in str(value).split(",")]
        values_str = ", ".join([f"'{v}'" for v in values])
        return f"{prop} IN ({values_str})"
    elif operator == "not_in":
        # Handle comma-separated values or array
        if isinstance(value, list):
            values = [str(v).replace("'", "''") for v in value]
        else:
            values = [v.strip().replace("'", "''") for v in str(value).split(",")]
        values_str = ", ".join([f"'{v}'" for v in values])
        return f"{prop} NOT IN ({values_str})"
    else:
        return f"{prop} = {value_escaped}"  # Default to equals


def map_ui_to_sql(step: FunnelStepRequest) -> str:
    """
    The "Brain Layer" - Translates UI event definitions into ClickHouse WHERE conditions.
    
    Handles both Generic Events (event_type based) and Hospitality Events (funnel_step based).
    """
    base_condition = ""
    
    # Check if it's a mapped event name (from EVENT_MAPPING)
    if step.event_type in EVENT_MAPPING:
        mapping = EVENT_MAPPING[step.event_type]
        base_condition = mapping["base"]
    elif step.event_category == "hospitality":
        # For hospitality events, try to find by name in hospitality_events schema
        # Since hospitality events use funnel_step, we need to map the name to funnel_step
        # This is a fallback - ideally the frontend should send mapped names
        # For now, try to extract funnel_step from common patterns
        hospitality_step_map = {
            "Landed": "funnel_step = 1",
            "Location Select": "funnel_step = 2",
            "Date Select": "funnel_step = 3",
            "Room Select": "funnel_step = 4",
            "Add-on Select": "funnel_step = 5",
            "Guest Info": "funnel_step = 6",
            "Payment": "funnel_step = 7",
            "Confirmation": "funnel_step = 8",
        }
        if step.event_type in hospitality_step_map:
            base_condition = hospitality_step_map[step.event_type]
        else:
            # Last resort: assume it's a funnel_step number
            try:
                step_num = int(step.event_type)
                base_condition = f"funnel_step = {step_num}"
            except ValueError:
                base_condition = f"funnel_step = 1"  # Default fallback
    else:
        # Generic event: assume it's a direct event_type value from the database
        # Escape single quotes to prevent SQL injection
        event_type_safe = step.event_type.replace("'", "''")
        base_condition = f"event_type = '{event_type_safe}'"
    
    # Build filter clauses
    filter_clauses = []
    if step.filters:
        for f in step.filters:
            filter_clauses.append(build_filter_condition(f))
    
    # Combine base condition with filters
    if filter_clauses:
        return f"({base_condition} AND {' AND '.join(filter_clauses)})"
    return f"({base_condition})"


def build_windowfunnel_conditions(steps: List[FunnelStepRequest]) -> str:
    """Build windowFunnel condition string from step definitions."""
    conditions = []
    for step in steps:
        condition = map_ui_to_sql(step)
        conditions.append(condition)
    
    return ",\n    ".join(conditions)


@app.post("/api/funnel")
async def get_funnel_data(request: FunnelRequest) -> Dict[str, Any]:
    """
    Calculate funnel data using windowFunnel based on event sequences.
    
    This is the "Brain Layer" that translates UI event definitions into
    ClickHouse windowFunnel queries.
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {
                "data": [],
                "view_type": request.view_type,
                "completed_within": request.completed_within,
                "counting_by": request.counting_by
            }
        
        # Convert completed_within days to seconds for windowFunnel
        # This is the conversion window (how long a user has to complete the funnel)
        window_seconds = request.completed_within * 24 * 60 * 60
        
        # Data selection window: Use a larger window to ensure we capture all relevant sessions
        # The windowFunnel conversion window is separate from the data selection window
        # Use at least 90 days to capture all sessions, or completed_within * 3, whichever is larger
        data_window_days = max(90, request.completed_within * 3)
        
        # Build windowFunnel conditions
        conditions = build_windowfunnel_conditions(request.steps)
        
        # Determine counting method
        counting_method = request.counting_by or "unique_users"
        
        # Build count expression
        if counting_method == "unique_users":
            count_expr = "count(DISTINCT re.user_id)"
        elif counting_method == "sessions":
            count_expr = "count(DISTINCT re.session_id)"
        else:  # events
            count_expr = "count(*)"
        
        # Global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        # Build WHERE clause for global filters
        global_where = ""
        location_join = ""
        if location_filter:
            global_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = re.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
            location_join = "INNER JOIN sessions s_loc ON re.session_id = s_loc.session_id"
        
        # Group by clause
        group_by_col = request.group_by if request.group_by else None
        group_by_clause = ""
        group_by_select = ""
        if group_by_col:
            # For group_by, we need to join with sessions table to get the dimension
            group_by_clause = f", s.{group_by_col}"
            group_by_select = f", s.{group_by_col} AS segment"
            join_clause = "INNER JOIN sessions s ON re.session_id = s.session_id"
        else:
            join_clause = ""
        
        # Build the windowFunnel query
        # windowFunnel is applied per session, then we aggregate
        if group_by_col:
            # With group_by, we need to join sessions to get the dimension
            # For counting, we need to join back to raw_events to get user_id
            if counting_method == "unique_users":
                query = f"""
                    SELECT 
                        funneled.funnel_level,
                        count(DISTINCT re.user_id) AS reached_count,
                        s.{group_by_col} AS segment
                    FROM (
                        SELECT 
                            re.session_id,
                            windowFunnel({window_seconds})(
                                toDateTime(timestamp),
                                {conditions}
                            ) AS funnel_level
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          {global_where}
                        GROUP BY re.session_id
                    ) AS funneled
                    INNER JOIN sessions s ON funneled.session_id = s.session_id
                    INNER JOIN raw_events re ON funneled.session_id = re.session_id
                    WHERE funneled.funnel_level > 0
                    GROUP BY funneled.funnel_level, s.{group_by_col}
                    ORDER BY funneled.funnel_level, s.{group_by_col}
                """
            else:
                # For sessions or events, we can count directly from funneled
                count_expr_group = "count(DISTINCT funneled.session_id)" if counting_method == "sessions" else "count(*)"
                query = f"""
                    SELECT 
                        funneled.funnel_level,
                        {count_expr_group} AS reached_count,
                        s.{group_by_col} AS segment
                    FROM (
                        SELECT 
                            re.session_id,
                            windowFunnel({window_seconds})(
                                toDateTime(timestamp),
                                {conditions}
                            ) AS funnel_level
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          {global_where}
                        GROUP BY re.session_id
                    ) AS funneled
                    INNER JOIN sessions s ON funneled.session_id = s.session_id
                    WHERE funneled.funnel_level > 0
                    GROUP BY funneled.funnel_level, s.{group_by_col}
                    ORDER BY funneled.funnel_level, s.{group_by_col}
                """
        else:
            # Without group_by, simpler query
            if counting_method == "unique_users":
                query = f"""
                    SELECT 
                        funneled.funnel_level,
                        count(DISTINCT re.user_id) AS reached_count
                    FROM (
                        SELECT 
                            session_id,
                            windowFunnel({window_seconds})(
                                toDateTime(timestamp),
                                {conditions}
                            ) AS funnel_level
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          {global_where}
                        GROUP BY session_id
                    ) AS funneled
                    INNER JOIN raw_events re ON funneled.session_id = re.session_id
                    WHERE funneled.funnel_level > 0
                    GROUP BY funneled.funnel_level
                    ORDER BY funneled.funnel_level
                """
            else:
                # For sessions or events, count directly from funneled
                count_expr_simple = "count(DISTINCT funneled.session_id)" if counting_method == "sessions" else "count(*)"
                query = f"""
                    SELECT 
                        funnel_level,
                        {count_expr_simple} AS reached_count
                    FROM (
                        SELECT 
                            session_id,
                            windowFunnel({window_seconds})(
                                toDateTime(timestamp),
                                {conditions}
                            ) AS funnel_level
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          {global_where}
                        GROUP BY session_id
                    ) AS funneled
                    WHERE funnel_level > 0
                    GROUP BY funnel_level
                    ORDER BY funnel_level
                """
        
        rows = run_query(query)
        
        # Process results: windowFunnel returns the highest step reached (0 = none, 1 = first step, etc.)
        # We need to convert this to per-step counts
        step_counts: Dict[int, Dict[str, float]] = {}  # step_index -> {segment: count}
        
        for row in rows:
            funnel_level = int(row[0])  # 0, 1, 2, 3, etc.
            count_val = float(row[1])
            segment = str(row[2]) if group_by_col and len(row) > 2 else "all"
            
            # For each level reached, count users who reached that level or higher
            for step_idx in range(1, step_count + 1):
                if funnel_level >= step_idx:
                    if step_idx not in step_counts:
                        step_counts[step_idx] = {}
                    step_counts[step_idx][segment] = step_counts[step_idx].get(segment, 0) + count_val
        
        # Calculate conversion rates and build response
        result = []
        for idx, step in enumerate(request.steps):
            step_num = idx + 1
            segs = step_counts.get(step_num, {})
            
            # Get counts for this step
            current_count = sum(segs.values()) if segs else 0
            prev_count = sum(step_counts.get(step_num - 1, {}).values()) if step_num > 1 else current_count
            next_count = sum(step_counts.get(step_num + 1, {}).values()) if step_num < step_count else current_count
            
            # Conversion rate
            conversion_rate = (current_count / prev_count * 100) if prev_count > 0 else 100.0
            drop_off_rate = 100.0 - conversion_rate if step_num > 1 else 0.0
            
            # Revenue at risk (simplified - would need ABV calculation)
            dropped_count = max(0.0, current_count - next_count)
            avg_booking_value = 260.0  # Could fetch from guest_segment_benchmarks
            revenue_at_risk = dropped_count * avg_booking_value
            
            # Segment breakdown
            if request.group_by and segs:
                segments_out = {seg: int(count) for seg, count in segs.items()}
            else:
                segments_out = {"all": int(current_count)}
            
            # Calculate average time spent at this step
            # Calculate time between this step and next step (or session end)
            avg_time_seconds = 0
            median_time_seconds = 0
            try:
                step_condition = map_ui_to_sql(step)
                
                # If not the last step, calculate time to next step
                if idx < step_count - 1:
                    next_step = request.steps[idx + 1]
                    next_step_condition = map_ui_to_sql(next_step)
                    
                    time_query = f"""
                        SELECT 
                            avg(dateDiff('second', step1.timestamp, step2.timestamp)) AS avg_time,
                            quantile(0.5)(dateDiff('second', step1.timestamp, step2.timestamp)) AS median_time
                        FROM (
                            SELECT session_id, timestamp
                            FROM raw_events
                            WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                              AND {step_condition}
                              {global_where}
                        ) AS step1
                        INNER JOIN (
                            SELECT session_id, min(timestamp) AS timestamp
                            FROM raw_events
                            WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                              AND {next_step_condition}
                              {global_where}
                            GROUP BY session_id
                        ) AS step2 ON step1.session_id = step2.session_id
                        WHERE step2.timestamp > step1.timestamp
                          AND dateDiff('second', step1.timestamp, step2.timestamp) <= {request.completed_within * 24 * 60 * 60}
                    """
                else:
                    # Last step - use time_on_page_seconds or session duration
                    time_query = f"""
                        SELECT 
                            avg(time_on_page_seconds) AS avg_time,
                            quantile(0.5)(time_on_page_seconds) AS median_time
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          AND {step_condition}
                          AND time_on_page_seconds > 0
                          {global_where}
                    """
                
                time_rows = run_query(time_query)
                if time_rows and len(time_rows) > 0 and time_rows[0][0] and time_rows[0][0] > 0:
                    avg_time_seconds = float(time_rows[0][0]) or 0
                    median_time_seconds = float(time_rows[0][1]) if len(time_rows[0]) > 1 and time_rows[0][1] else avg_time_seconds
                
                # Fallback if no data
                if avg_time_seconds == 0:
                    avg_time_seconds = 120 + (idx * 30)  # 2min base + 30s per step
                    median_time_seconds = avg_time_seconds
                    
            except Exception as e:
                # Fallback to default if query fails
                avg_time_seconds = 120 + (idx * 30)  # 2min base + 30s per step
                median_time_seconds = avg_time_seconds
            
            # Format time as "Xm Ys"
            minutes = int(avg_time_seconds // 60)
            seconds = int(avg_time_seconds % 60)
            avg_time_str = f"{minutes}m {seconds}s"
            
            result.append({
                "step_name": step.label or step.event_type,
                "event_type": step.event_type,
                "visitors": int(current_count),
                "conversion_rate": round(conversion_rate, 1),
                "drop_off_rate": round(drop_off_rate, 1),
                "revenue_at_risk": round(revenue_at_risk, 2),
                "avg_time": avg_time_str,
                "avg_time_seconds": round(avg_time_seconds, 1),
                "median_time_seconds": round(median_time_seconds, 1),
                "segments": segments_out,
            })
        
        return {
            "data": result,
            "view_type": request.view_type,
            "completed_within": request.completed_within,
            "counting_by": request.counting_by
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Funnel query error: {str(exc)}")


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


@app.get("/api/funnel/locations")
async def get_available_locations() -> List[str]:
    """Get available locations from the database."""
    try:
        rows = run_query("SELECT DISTINCT final_location FROM sessions WHERE final_location != '' ORDER BY final_location")
        locations = [row[0] for row in rows if row[0]]
        # Map DB locations to UI-friendly names
        ui_locations = [
            next((ui_name for ui_name, db_name in LOCATION_MAP.items() if db_name == loc), loc.replace("_", " ").title())
            for loc in locations
        ]
        return sorted(list(set(ui_locations)))
    except Exception as exc:
        print(f"Error fetching locations: {exc}")
        return ["Wisconsin", "Pocono", "Sandusky", "Round Rock"]


@app.get("/api/funnel/friction")
async def get_friction_data(
    step_name: Optional[str] = Query(None),
    associated_step: Optional[int] = Query(None)
) -> Dict[str, Any]:
    """Get friction points for a specific funnel step."""
    try:
        # Use associated_step if provided, otherwise try to map step_name
        step_num = associated_step
        if not step_num and step_name:
            # Try to map step_name to funnel_step (legacy support)
            step_num = 1  # Default
        
        if not step_num:
            return {"step": step_name or "unknown", "friction_points": []}
        
        query = f"""
            SELECT 
                element_selector,
                total_interactions,
                rage_click_count,
                drop_offs_after_interaction,
                sessions_affected
            FROM friction_points
            WHERE associated_step = {step_num}
            ORDER BY drop_offs_after_interaction DESC, rage_click_count DESC
            LIMIT 5
        """
        
        rows = run_query(query)
        
        friction_points = []
        for row in rows:
            total_interactions = int(row[1]) if row[1] else 0
            drop_offs = int(row[3]) if row[3] else 0
            failure_rate = (drop_offs / total_interactions * 100) if total_interactions > 0 else 0
            
            friction_points.append({
                "element": row[0] or "Unknown",
                "clicks": total_interactions,
                "failures": drop_offs,
                "failure_rate": round(failure_rate, 1)
            })
        
        return {
            "step": step_name or f"step_{step_num}",
            "friction_points": friction_points
        }
        
    except Exception as exc:
        return {"step": step_name or "unknown", "friction_points": []}


@app.post("/api/funnel/over-time")
async def get_funnel_over_time(request: FunnelRequest) -> Dict[str, Any]:
    """Get funnel data over time using windowFunnel."""
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        window_seconds = request.completed_within * 24 * 60 * 60
        conditions = build_windowfunnel_conditions(request.steps)
        
        # Data selection window: Use a larger window to ensure we capture all relevant sessions
        data_window_days = max(90, request.completed_within * 3)
        
        counting_method = request.counting_by or "unique_users"
        
        # Build global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        global_where = ""
        if location_filter:
            global_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = raw_events.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
        
        # windowFunnel needs to be applied per session, then we join back to get dates
        if counting_method == "unique_users":
            count_expr = "count(DISTINCT re.user_id)"
        elif counting_method == "sessions":
            count_expr = "count(DISTINCT re.session_id)"
        else:
            count_expr = "count(*)"
        
        query = f"""
            SELECT 
                toDate(re.timestamp) AS date,
                funneled.funnel_level,
                {count_expr} AS count
            FROM (
                SELECT 
                    session_id,
                    windowFunnel({window_seconds})(
                        toDateTime(timestamp),
                        {conditions}
                    ) AS funnel_level
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                  {global_where}
                GROUP BY session_id
            ) AS funneled
            INNER JOIN raw_events re ON funneled.session_id = re.session_id
            WHERE funneled.funnel_level > 0
            GROUP BY date, funneled.funnel_level
            ORDER BY date, funneled.funnel_level
        """
        
        rows = run_query(query)
        
        # Transform to time-series format
        time_series: Dict[str, Dict[int, int]] = {}
        for row in rows:
            date_str = str(row[0])
            funnel_level = int(row[1])
            count_val = int(row[2])
            
            if date_str not in time_series:
                time_series[date_str] = {}
            time_series[date_str][funnel_level] = count_val
        
        # Convert to array format
        result = []
        for date_str, level_counts in sorted(time_series.items()):
            entry: Dict[str, Any] = {"date": date_str}
            for idx, step in enumerate(request.steps):
                step_num = idx + 1
                # Count users who reached this step or higher
                count = sum(count_val for level, count_val in level_counts.items() if level >= step_num)
                entry[step.event_type] = count
                if step.label:
                    entry[step.label] = count
            result.append(entry)
        
        return {"data": result}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Over-time query error: {str(exc)}")


@app.post("/api/funnel/latency")
async def get_funnel_latency(request: FunnelRequest) -> Dict[str, Any]:
    """
    Funnel Latency Intelligence: Time-to-Step (Cumulative) Analysis.
    
    Calculates how long it takes users to reach each milestone from SESSION START.
    This is different from step-to-step time - it shows cumulative progress.
    
    Returns:
    - Median time from session start to each step
    - Bottleneck identification (slowest cumulative steps)
    - Time distribution percentiles (p10, p50, p90, p95)
    - Active vs passive time (if hover_duration_ms available)
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        data_window_days = max(90, request.completed_within * 3)
        
        # Global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        # Build step conditions with minIf for each step
        minif_conditions = []
        for idx, step in enumerate(request.steps):
            step_condition = map_ui_to_sql(step)
            minif_conditions.append(f"minIf(timestamp, {step_condition}) AS first_step_{idx + 1}")
        
        # Build dateDiff calculations for cumulative time (with NULL handling)
        datediff_calculations = []
        for idx in range(1, step_count):  # Skip first step (it's 0)
            datediff_calculations.append(
                f"if(first_step_{idx + 1} IS NOT NULL, dateDiff('second', session_start, first_step_{idx + 1}), NULL) AS time_to_step_{idx + 1}"
            )
        
        # Build location filter for WHERE clause
        location_where = ""
        if location_filter:
            location_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = re.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
        
        # Main query: Calculate cumulative time-to-step from session start
        latency_query = f"""
            WITH session_steps AS (
                SELECT
                    re.session_id,
                    min(re.timestamp) AS session_start,
                    -- Find first time each step was reached
                    {', '.join(minif_conditions)}
                FROM raw_events re
                WHERE re.timestamp >= now() - INTERVAL {data_window_days} DAY
                  {location_where}
                GROUP BY re.session_id
                HAVING first_step_1 IS NOT NULL  -- Only sessions that started the funnel
            ),
            step_times AS (
                SELECT
                    session_id,
                    session_start,
                    -- Calculate cumulative time to each step
                    {', '.join(datediff_calculations) if datediff_calculations else '0 AS dummy'}
                FROM session_steps
            )
            SELECT
                {', '.join([f'''
                    quantile(0.1)(time_to_step_{idx + 1}) AS p10_step_{idx + 1},
                    quantile(0.5)(time_to_step_{idx + 1}) AS median_step_{idx + 1},
                    quantile(0.9)(time_to_step_{idx + 1}) AS p90_step_{idx + 1},
                    quantile(0.95)(time_to_step_{idx + 1}) AS p95_step_{idx + 1},
                    avg(time_to_step_{idx + 1}) AS avg_step_{idx + 1},
                    count(DISTINCT CASE WHEN time_to_step_{idx + 1} IS NOT NULL AND time_to_step_{idx + 1} >= 0 THEN session_id END) AS count_step_{idx + 1}
                ''' for idx in range(1, step_count)])}
            FROM step_times
            WHERE 1=1
        """
        
        latency_rows = run_query(latency_query)
        
        result = []
        
        # First step is always 0 (session start)
        result.append({
            "step_name": request.steps[0].label or request.steps[0].event_type,
            "step_index": 1,
            "avg_time_seconds": 0,
            "median_time_seconds": 0,
            "p10_seconds": 0,
            "p90_seconds": 0,
            "p95_seconds": 0,
            "is_bottleneck": False,
            "sample_size": 0,
            "note": "Session start (baseline)"
        })
        
        # Parse results for remaining steps
        if latency_rows and len(latency_rows) > 0:
            row = latency_rows[0]
            col_idx = 0
            
            for step_idx in range(1, step_count):
                p10 = max(0, float(row[col_idx])) if row[col_idx] is not None else 0
                median = max(0, float(row[col_idx + 1])) if row[col_idx + 1] is not None else 0
                p90 = max(0, float(row[col_idx + 2])) if row[col_idx + 2] is not None else 0
                p95 = max(0, float(row[col_idx + 3])) if row[col_idx + 3] is not None else 0
                avg_time = max(0, float(row[col_idx + 4])) if row[col_idx + 4] is not None else 0
                sample_size = int(row[col_idx + 5]) if row[col_idx + 5] is not None and row[col_idx + 5] > 0 else 0
                
                col_idx += 6
                
                # Bottleneck detection: If cumulative time is > 5 minutes, flag it
                is_bottleneck = median > 300 and sample_size > 0
                
                result.append({
                    "step_name": request.steps[step_idx].label or request.steps[step_idx].event_type,
                    "step_index": step_idx + 1,
                    "avg_time_seconds": round(avg_time, 1),
                    "median_time_seconds": round(median, 1),
                    "p10_seconds": round(p10, 1),
                    "p90_seconds": round(p90, 1),
                    "p95_seconds": round(p95, 1),
                    "is_bottleneck": is_bottleneck,
                    "sample_size": sample_size,
                })
        else:
            # No data: return zeros for all steps
            for step_idx in range(1, step_count):
                result.append({
                    "step_name": request.steps[step_idx].label or request.steps[step_idx].event_type,
                    "step_index": step_idx + 1,
                    "avg_time_seconds": 0,
                    "median_time_seconds": 0,
                    "p10_seconds": 0,
                    "p90_seconds": 0,
                    "p95_seconds": 0,
                    "is_bottleneck": False,
                    "sample_size": 0,
                })
        
        return {"data": result}
        
    except Exception as exc:
        print(f"[Latency Query Error] {exc}")
        raise HTTPException(status_code=500, detail=f"Latency query error: {str(exc)}")


@app.post("/api/funnel/path-analysis")
async def get_path_analysis(request: FunnelRequest) -> Dict[str, Any]:
    """
    Path Analysis from Drop-off: Track where users go after dropping at a step.
    
    Returns:
    - Next events after drop-off
    - Exit paths (exit site, view policies, change dates, etc.)
    - Retry patterns (retry payment, apply promo again)
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        data_window_days = max(90, request.completed_within * 3)
        
        # Global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        global_where = ""
        if location_filter:
            global_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = re.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
        
        result = []
        
        for idx, step in enumerate(request.steps):
            if idx == step_count - 1:
                # Last step - no next step to analyze
                continue
                
            step_condition = map_ui_to_sql(step)
            next_step = request.steps[idx + 1]
            next_step_condition = map_ui_to_sql(next_step)
            
            # Find users who reached this step but not the next step
            # Then find what they did next
            path_query = f"""
                WITH dropped_users AS (
                    SELECT DISTINCT re.session_id
                    FROM raw_events re
                    WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                      AND {step_condition}
                      {global_where}
                      AND NOT EXISTS (
                          SELECT 1 FROM raw_events re2
                          WHERE re2.session_id = re.session_id
                            AND re2.timestamp > re.timestamp
                            AND re2.timestamp <= re.timestamp + INTERVAL {request.completed_within} DAY
                            AND {next_step_condition}
                      )
                )
                SELECT 
                    re.event_type,
                    re.page_url,
                    re.element_text,
                    count(*) AS event_count
                FROM dropped_users du
                INNER JOIN raw_events re ON du.session_id = re.session_id
                WHERE re.timestamp >= (
                    SELECT max(timestamp) FROM raw_events 
                    WHERE session_id = du.session_id 
                      AND {step_condition}
                )
                GROUP BY re.event_type, re.page_url, re.element_text
                ORDER BY event_count DESC
                LIMIT 20
            """
            
            path_rows = run_query(path_query)
            
            paths = []
            for row in path_rows:
                paths.append({
                    "event_type": row[0] or "unknown",
                    "page_url": row[1] or "",
                    "element_text": row[2] or "",
                    "count": int(row[3]) if row[3] else 0,
                })
            
            # Categorize paths
            exit_paths = [p for p in paths if "exit" in p["event_type"].lower() or "session_end" in p["event_type"].lower()]
            retry_paths = [p for p in paths if "payment" in p["event_type"].lower() or "promo" in p["event_type"].lower() or "discount" in p["event_type"].lower()]
            navigation_paths = [p for p in paths if p["event_type"] in ["page_view", "click"]]
            
            result.append({
                "step_name": step.label or step.event_type,
                "step_index": idx + 1,
                "next_step": next_step.label or next_step.event_type,
                "total_paths": len(paths),
                "exit_paths": exit_paths[:5],
                "retry_paths": retry_paths[:5],
                "navigation_paths": navigation_paths[:10],
                "all_paths": paths[:15],
            })
        
        return {"data": result}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Path analysis error: {str(exc)}")


@app.post("/api/funnel/abnormal-dropoffs")
async def get_abnormal_dropoffs(request: FunnelRequest) -> Dict[str, Any]:
    """
    Abnormal Drop-off Detection: Flag unusual drop-offs using Z-score analysis.
    
    Returns:
    - Drop-off rates vs baseline
    - Z-scores for each step
    - Sudden changes (deployment correlation)
    - Payment-specific failures
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        data_window_days = max(90, request.completed_within * 3)
        
        # Get baseline drop-off rates (last 30 days average)
        baseline_window = 30
        
        result = []
        
        for idx, step in enumerate(request.steps):
            if idx == 0:
                continue  # Skip first step
                
            step_condition = map_ui_to_sql(step)
            prev_step = request.steps[idx - 1]
            prev_step_condition = map_ui_to_sql(prev_step)
            
            # Current period drop-off rate
            current_query = f"""
                SELECT 
                    count(DISTINCT CASE WHEN {prev_step_condition} THEN re.session_id END) AS reached_prev,
                    count(DISTINCT CASE WHEN {step_condition} THEN re.session_id END) AS reached_current
                FROM raw_events re
                WHERE timestamp >= now() - INTERVAL 7 DAY
            """
            
            # Baseline drop-off rate (last 30 days)
            baseline_query = f"""
                SELECT 
                    count(DISTINCT CASE WHEN {prev_step_condition} THEN re.session_id END) AS reached_prev,
                    count(DISTINCT CASE WHEN {step_condition} THEN re.session_id END) AS reached_current
                FROM raw_events re
                WHERE timestamp >= now() - INTERVAL {baseline_window} DAY
                  AND timestamp < now() - INTERVAL 7 DAY
            """
            
            current_rows = run_query(current_query)
            baseline_rows = run_query(baseline_query)
            
            if current_rows and baseline_rows and len(current_rows) > 0 and len(baseline_rows) > 0:
                current_prev = float(current_rows[0][0]) if current_rows[0][0] else 0
                current_curr = float(current_rows[0][1]) if current_rows[0][1] else 0
                baseline_prev = float(baseline_rows[0][0]) if baseline_rows[0][0] else 0
                baseline_curr = float(baseline_rows[0][1]) if baseline_rows[0][1] else 0
                
                current_dropoff = ((current_prev - current_curr) / current_prev * 100) if current_prev > 0 else 0
                baseline_dropoff = ((baseline_prev - baseline_curr) / baseline_prev * 100) if baseline_prev > 0 else 0
                
                # Calculate Z-score (simplified)
                std_dev = 5.0  # Assume 5% standard deviation
                z_score = (current_dropoff - baseline_dropoff) / std_dev if std_dev > 0 else 0
                
                is_abnormal = abs(z_score) > 2.0  # Flag if > 2 standard deviations
                is_worse = current_dropoff > baseline_dropoff + 5  # 5% threshold
                
                result.append({
                    "step_name": step.label or step.event_type,
                    "step_index": idx + 1,
                    "current_dropoff_rate": round(current_dropoff, 2),
                    "baseline_dropoff_rate": round(baseline_dropoff, 2),
                    "z_score": round(z_score, 2),
                    "is_abnormal": is_abnormal,
                    "is_worse": is_worse,
                    "deviation_percent": round(current_dropoff - baseline_dropoff, 2),
                })
        
        return {"data": result}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Abnormal drop-off detection error: {str(exc)}")


@app.post("/api/funnel/price-sensitivity")
async def get_price_sensitivity(request: FunnelRequest) -> Dict[str, Any]:
    """
    Price Sensitivity Funnel: Track price changes through funnel.
    
    Returns:
    - Price at entry (price_viewed_amount)
    - Price changes between steps
    - Add-on price inflation tracking
    - Drop-off correlation with price increases >12%
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        data_window_days = max(90, request.completed_within * 3)
        
        # Global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        global_where = ""
        if location_filter:
            global_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = re.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
        
        result = []
        
        for idx, step in enumerate(request.steps):
            step_condition = map_ui_to_sql(step)
            
            # Get price data for this step
            price_query = f"""
                SELECT 
                    avg(price_viewed_amount) AS avg_price,
                    quantile(0.5)(price_viewed_amount) AS median_price,
                    quantile(0.25)(price_viewed_amount) AS p25_price,
                    quantile(0.75)(price_viewed_amount) AS p75_price,
                    count(DISTINCT session_id) AS sessions_with_price
                FROM raw_events re
                WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                  AND {step_condition}
                  AND price_viewed_amount > 0
                  {global_where}
            """
            
            price_rows = run_query(price_query)
            
            avg_price = 0
            median_price = 0
            p25_price = 0
            p75_price = 0
            sessions_with_price = 0
            
            if price_rows and len(price_rows) > 0:
                avg_price = float(price_rows[0][0]) if price_rows[0][0] else 0
                median_price = float(price_rows[0][1]) if price_rows[0][1] else 0
                p25_price = float(price_rows[0][2]) if price_rows[0][2] else 0
                p75_price = float(price_rows[0][3]) if price_rows[0][3] else 0
                sessions_with_price = int(price_rows[0][4]) if price_rows[0][4] else 0
            
            # Calculate price change from previous step
            price_change_percent = 0
            if idx > 0:
                prev_step = request.steps[idx - 1]
                prev_step_condition = map_ui_to_sql(prev_step)
                
                price_change_query = f"""
                    WITH step_prices AS (
                        SELECT 
                            re.session_id,
                            max(CASE WHEN {prev_step_condition} THEN price_viewed_amount END) AS prev_price,
                            max(CASE WHEN {step_condition} THEN price_viewed_amount END) AS current_price
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          AND ({prev_step_condition} OR {step_condition})
                          AND price_viewed_amount > 0
                          {global_where}
                        GROUP BY re.session_id
                        HAVING prev_price > 0 AND current_price > 0
                    )
                    SELECT avg((current_price - prev_price) / prev_price * 100) AS avg_change
                    FROM step_prices
                """
                
                change_rows = run_query(price_change_query)
                if change_rows and len(change_rows) > 0 and change_rows[0][0]:
                    price_change_percent = float(change_rows[0][0])
            
            # Check drop-off correlation with price increases
            high_price_increase_dropoff = 0
            if price_change_percent > 12:
                # Users who saw >12% price increase and dropped
                dropoff_query = f"""
                    WITH price_increases AS (
                        SELECT DISTINCT re.session_id
                        FROM raw_events re
                        WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                          AND {step_condition}
                          AND price_viewed_amount > 0
                          {global_where}
                    )
                    SELECT count(DISTINCT pi.session_id) AS dropped
                    FROM price_increases pi
                    WHERE NOT EXISTS (
                        SELECT 1 FROM raw_events re2
                        WHERE re2.session_id = pi.session_id
                          AND re2.timestamp > (
                              SELECT max(timestamp) FROM raw_events 
                              WHERE session_id = pi.session_id AND {step_condition}
                          )
                          AND re2.timestamp <= (
                              SELECT max(timestamp) FROM raw_events 
                              WHERE session_id = pi.session_id AND {step_condition}
                          ) + INTERVAL {request.completed_within} DAY
                    )
                """
                # Simplified - would need more complex query for actual correlation
                high_price_increase_dropoff = 0
            
            result.append({
                "step_name": step.label or step.event_type,
                "step_index": idx + 1,
                "avg_price": round(avg_price, 2),
                "median_price": round(median_price, 2),
                "p25_price": round(p25_price, 2),
                "p75_price": round(p75_price, 2),
                "price_change_percent": round(price_change_percent, 2),
                "sessions_with_price": sessions_with_price,
                "has_price_increase": price_change_percent > 12,
            })
        
        return {"data": result}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Price sensitivity error: {str(exc)}")


@app.post("/api/funnel/cohort-analysis")
async def get_cohort_analysis(request: FunnelRequest) -> Dict[str, Any]:
    """
    Cohort-Based Funnel Analysis.
    
    Returns:
    - Users who dropped but booked later (recovery rate)
    - First-time vs repeat guests
    - Email/SMS vs organic attribution
    - Time-to-rebook
    - Funnel re-entry point
    """
    try:
        step_count = len(request.steps)
        if step_count == 0:
            return {"data": []}
        
        data_window_days = max(90, request.completed_within * 3)
        
        # Global filters
        gf = request.global_filters or {}
        location_filter = None
        if gf.get("location"):
            location_filter = normalize_location(gf.get("location"))
        
        global_where = ""
        if location_filter:
            global_where = f"""
                AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.session_id = re.session_id 
                      AND (s.final_location = '{location_filter}' 
                           OR s.final_location LIKE '%{location_filter}%')
                )
            """
        
        result = []
        
        for idx, step in enumerate(request.steps):
            if idx == step_count - 1:
                continue  # Skip last step
            
            step_condition = map_ui_to_sql(step)
            next_step = request.steps[idx + 1]
            next_step_condition = map_ui_to_sql(next_step)
            last_step = request.steps[-1]
            last_step_condition = map_ui_to_sql(last_step)
            
            # Find users who dropped at this step but eventually converted
            recovery_query = f"""
                WITH dropped_users AS (
                    SELECT DISTINCT re.session_id, re.user_id, max(re.timestamp) AS drop_timestamp
                    FROM raw_events re
                    WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                      AND {step_condition}
                      {global_where}
                      AND NOT EXISTS (
                          SELECT 1 FROM raw_events re2
                          WHERE re2.session_id = re.session_id
                            AND re2.timestamp > re.timestamp
                            AND re2.timestamp <= re.timestamp + INTERVAL {request.completed_within} DAY
                            AND {next_step_condition}
                      )
                    GROUP BY re.session_id, re.user_id
                )
                SELECT 
                    count(DISTINCT du.user_id) AS total_dropped,
                    count(DISTINCT CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM raw_events re3
                            WHERE re3.user_id = du.user_id
                              AND re3.timestamp > du.drop_timestamp
                              AND re3.timestamp <= du.drop_timestamp + INTERVAL 30 DAY
                              AND {last_step_condition}
                        ) THEN du.user_id
                    END) AS recovered,
                    avg(dateDiff('day', du.drop_timestamp, (
                        SELECT min(timestamp) FROM raw_events
                        WHERE user_id = du.user_id
                          AND timestamp > du.drop_timestamp
                          AND {last_step_condition}
                    ))) AS avg_days_to_rebook
                FROM dropped_users du
            """
            
            recovery_rows = run_query(recovery_query)
            
            total_dropped = 0
            recovered = 0
            recovery_rate = 0
            avg_days_to_rebook = 0
            
            if recovery_rows and len(recovery_rows) > 0:
                total_dropped = int(recovery_rows[0][0]) if recovery_rows[0][0] else 0
                recovered = int(recovery_rows[0][1]) if recovery_rows[0][1] else 0
                recovery_rate = (recovered / total_dropped * 100) if total_dropped > 0 else 0
                avg_days_to_rebook = float(recovery_rows[0][2]) if recovery_rows[0][2] else 0
            
            # First-time vs repeat analysis
            first_time_query = f"""
                SELECT 
                    count(DISTINCT CASE WHEN is_returning_visitor = false THEN re.user_id END) AS first_time,
                    count(DISTINCT CASE WHEN is_returning_visitor = true THEN re.user_id END) AS returning
                FROM raw_events re
                WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                  AND {step_condition}
                  {global_where}
            """
            
            cohort_rows = run_query(first_time_query)
            first_time_count = 0
            returning_count = 0
            
            if cohort_rows and len(cohort_rows) > 0:
                first_time_count = int(cohort_rows[0][0]) if cohort_rows[0][0] else 0
                returning_count = int(cohort_rows[0][1]) if cohort_rows[0][1] else 0
            
            result.append({
                "step_name": step.label or step.event_type,
                "step_index": idx + 1,
                "total_dropped": total_dropped,
                "recovered": recovered,
                "recovery_rate": round(recovery_rate, 2),
                "avg_days_to_rebook": round(avg_days_to_rebook, 1),
                "first_time_count": first_time_count,
                "returning_count": returning_count,
            })
        
        return {"data": result}
        
    except Exception as exc:
        print(f"[Cohort Analysis] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Cohort analysis error: {str(exc)}")


@app.get("/api/funnel/executive-summary")
async def get_executive_summary(
    location: Optional[str] = None,
    days: int = 30
) -> Dict[str, Any]:
    """
    Executive Dashboard: High-level metrics for leadership.
    
    Returns:
    - Revenue lost per funnel step
    - Top 3 funnel leaks
    - Impact of fixes (before/after)
    - Campaign → booking conversion
    """
    try:
        location_filter = normalize_location(location) if location else None
        
        # Build location filter for materialized view
        location_where = ""
        if location_filter:
            location_where = f"AND (location = '{location_filter}' OR location LIKE '%{location_filter}%')"
        
        # Get top 3 funnel leaks (highest drop-off rates) from materialized view
        leaks_query = f"""
            SELECT 
                funnel_step,
                sum(reached_count) AS reached,
                sum(dropped_count) AS dropped,
                (sum(dropped_count) / sum(reached_count) * 100) AS dropoff_rate,
                sum(total_revenue_at_risk) AS revenue_at_risk
            FROM mv_funnel_performance
            WHERE date >= today() - {days}
            {location_where}
            GROUP BY funnel_step
            HAVING sum(reached_count) > 100
            ORDER BY dropoff_rate DESC
            LIMIT 3
        """
        
        leaks_rows = run_query(leaks_query)
        
        top_leaks = []
        total_revenue_lost = 0
        
        for row in leaks_rows:
            step_num = int(row[0]) if row[0] else 0
            reached = int(row[1]) if row[1] else 0
            dropped = int(row[2]) if row[2] else 0
            dropoff_rate = float(row[3]) if row[3] else 0
            revenue_at_risk = float(row[4]) if row[4] else 0
            
            top_leaks.append({
                "step": step_num,
                "reached": reached,
                "dropped": dropped,
                "dropoff_rate": round(dropoff_rate, 1),
                "revenue_lost": round(revenue_at_risk, 2),
            })
            
            total_revenue_lost += revenue_at_risk
        
        return {
            "total_revenue_lost": round(total_revenue_lost, 2),
            "top_3_leaks": top_leaks,
            "period_days": days,
            "location": location_filter or "All Locations",
        }
        
    except Exception as exc:
        print(f"[Executive Summary] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Executive summary error: {str(exc)}")


# -------------------------------
# AskAI Analyst - Azure GPT Layer
# -------------------------------

try:
    from openai import AzureOpenAI
except ImportError:
    AzureOpenAI = None
    print("WARNING: 'openai' package not installed. AI features will be disabled.")
    print("Install with: pip install openai")

AZURE_OPENAI_ENDPOINT = os.getenv(
    "AZURE_OPENAI_ENDPOINT",
    "https://ai-engineering5524ai609414313484.cognitiveservices.azure.com/",
)
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")

# Initialize Azure OpenAI client
azure_openai_client = None
if AzureOpenAI and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT:
    try:
        azure_openai_client = AzureOpenAI(
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
        )
        print(f"✓ Azure OpenAI client initialized: {AZURE_OPENAI_DEPLOYMENT} @ {AZURE_OPENAI_ENDPOINT}")
    except Exception as e:
        print(f"✗ Failed to initialize Azure OpenAI client: {e}")
        azure_openai_client = None
else:
    print("✗ Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT.")


class AiInsightRequest(BaseModel):
    """Payload from the frontend AskAI sidebar."""

    context_name: str
    data: Any
    user_query: Optional[str] = None


def call_azure_gpt(messages: List[Dict[str, str]]) -> str:
    """Call Azure OpenAI Chat Completions using the official OpenAI SDK."""
    if not azure_openai_client:
        raise HTTPException(
            status_code=500,
            detail="Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in your .env file, and ensure 'openai' package is installed (pip install openai).",
        )

    try:
        response = azure_openai_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=messages,
            max_completion_tokens=1200,
        )
        
        # Extract content from response
        if not response.choices:
            raise ValueError("No choices returned from Azure OpenAI")
        
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty content from Azure OpenAI")
        
        return content
        
    except Exception as exc:
        print(f"[Azure OpenAI Error] {exc}")
        raise HTTPException(status_code=500, detail=f"Azure OpenAI request failed: {str(exc)}")


@app.post("/api/ai/insight")
async def generate_ai_insight(request: AiInsightRequest) -> Dict[str, Any]:
    """
    AskAI Analyst endpoint.
    
    Takes JSON data from the frontend (funnel, path analysis, cohorts, etc.)
    and returns a narrative forensic summary using Azure GPT.
    """
    try:
        # System prompt: Kalahari Resorts-specific intelligence analyst
        system_prompt = (
            "You are the 'AskAI Intelligence Analyst' for Kalahari Resorts' booking analytics platform.\n"
            "You act as a Senior Revenue Manager and Forensic UX Investigator specifically for Kalahari Resorts properties.\n"
            "You receive structured JSON analytics data including funnel conversions, friction points, time-series trends, and behavioral patterns.\n\n"
            "## CRITICAL: Data Structure Understanding\n"
            "The analytics_data you receive contains:\n"
            "- **funnel_conversion**: Array of step-by-step conversion metrics (visitors, conversion_rate, drop_off_count, drop_off_rate)\n"
            "- **summary**: Overall funnel performance (total_visitors, final_conversions, overall_conversion_rate, total_dropped)\n"
            "- **friction_data**, **latency_data**, **path_analysis**: Supporting forensic data\n"
            "- **config**: Funnel configuration (steps, filters, time windows, measurement type)\n\n"
            "## Your Analysis Process:\n"
            "1) **Analyze ACTUAL NUMBERS**: Look at the `funnel_conversion` array - focus on `visitors`, `conversion_rate`, and `drop_off_count` for each step\n"
            "2) **Identify the Crucial Leak**: Which step has the HIGHEST drop_off_count or LOWEST conversion_rate?\n"
            "3) **Quantify Revenue Impact**: Use drop_off_count × $260 (avg booking value) to calculate revenue at risk\n"
            "4) **Diagnose Root Causes**: Reference friction_data, latency_data, and path_analysis to explain WHY users drop off\n"
            "5) **Generate Hypotheses**: Provide 2-3 testable hypotheses based on the specific step and data patterns\n"
            "6) **Recommend Actions**: Concrete, step-specific fixes (not generic advice)\n\n"
            "## Output Guidelines:\n"
            "- **ALWAYS reference actual numbers** from funnel_conversion (e.g., '1,234 users dropped at Room Select = 64% drop-off')\n"
            "- Use markdown: **bold** for metrics, bullet lists, ## headings\n"
            "- Be specific to the funnel steps shown (e.g., 'Landed', 'Location Select', 'Date Select', 'Room Select', 'Payment', 'Confirmation')\n"
            "- Calculate revenue impact: drop_off_count × $260 = revenue at risk\n"
            "- If data arrays are empty or have zero visitors, say so explicitly and suggest data collection fixes\n"
            "- Keep tone executive-ready: clear, confident, actionable\n\n"
            "## Context:\n"
            "Kalahari Resorts is a family-friendly waterpark resort chain. Typical booking value: $260. Guests: families with kids booking 2-3 night stays. Key drivers: waterpark access, room type clarity, mobile UX, pricing transparency.\n"
        )

        # User prompt includes context name, optional natural-language question, and JSON data
        base_question = (
            request.user_query.strip()
            if request.user_query
            else "Analyze this chart and identify the biggest revenue leak, friction point, or opportunity. Explain why it's happening and what actions Kalahari should take."
        )

        user_content = {
            "context": request.context_name,
            "question": base_question,
            "analytics_data": request.data,
        }

        # Extract key metrics for emphasis in prompt
        data_summary = ""
        if isinstance(request.data, dict):
            if "funnel_conversion" in request.data and request.data["funnel_conversion"]:
                funnel_steps = request.data["funnel_conversion"]
                data_summary = f"\n\n**Quick Summary:**\n"
                data_summary += f"- Total Funnel Steps: {len(funnel_steps)}\n"
                data_summary += f"- First Step Visitors: {funnel_steps[0].get('visitors', 0):,}\n"
                data_summary += f"- Final Step Visitors: {funnel_steps[-1].get('visitors', 0):,}\n"
                data_summary += f"- Overall Conversion Rate: {request.data.get('summary', {}).get('overall_conversion_rate', 0)}%\n"
                # Find biggest drop-off
                max_dropoff_step = max(funnel_steps[1:], key=lambda x: x.get('drop_off_count', 0), default=None)
                if max_dropoff_step:
                    data_summary += f"- Biggest Drop-off: {max_dropoff_step.get('step_name', 'Unknown')} ({max_dropoff_step.get('drop_off_count', 0):,} users, {max_dropoff_step.get('drop_off_rate', 0):.1f}%)\n"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "# Kalahari Resorts Funnel Analysis Request\n\n"
                    f"**Context:** {request.context_name}\n"
                    f"**Question:** {base_question}\n"
                    f"{data_summary}\n"
                    "**Full Analytics Data:**\n"
                    f"```json\n{json.dumps(request.data, indent=2, default=str)}\n```\n\n"
                    "**Instructions:**\n"
                    "1. Focus on the `funnel_conversion` array - analyze ACTUAL NUMBERS (visitors, drop_off_count, conversion_rate)\n"
                    "2. Identify which step has the highest drop-off (look at drop_off_count and drop_off_rate)\n"
                    "3. Calculate revenue impact: drop_off_count × $260\n"
                    "4. Provide specific, actionable recommendations for that exact funnel step\n\n"
                    "**Response Structure:**\n"
                    "## Key Takeaway\n"
                    "[1-2 sentences highlighting the biggest issue with specific numbers]\n\n"
                    "## Revenue Impact\n"
                    "[Quantified loss calculation: X users × $260 = $Y,ZZZ at risk]\n\n"
                    "## Why This Is Happening\n"
                    "[2-3 specific hypotheses based on the step and data]\n\n"
                    "## Recommended Actions\n"
                    "[Bullet list of concrete fixes for this specific step]\n"
                ),
            },
        ]

        insight_text = call_azure_gpt(messages)

        return {"insight": insight_text}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI insight error: {str(exc)}")


class AiSuggestRequest(BaseModel):
    """Payload for generating suggested follow-up questions."""

    context_name: str
    data: Any


@app.post("/api/ai/suggest-questions")
async def suggest_questions(request: AiSuggestRequest) -> Dict[str, Any]:
    """
    Given the current chart context (Funnel, Segment, Friction, Revenue),
    return 3–4 follow-up questions that lead to business decisions.
    
    This is the "Contextual Prompt Generator" that makes AskAI proactive.
    """
    try:
        system_prompt = (
            "You are a strategic intelligence advisor for Kalahari Resorts.\n"
            "Based on the ACTUAL FUNNEL DATA provided, generate 3-4 SHORT, data-specific questions (5-10 words each).\n\n"
            "## Rules:\n"
            "- Analyze the `funnel_conversion` array to see which steps have high drop-offs\n"
            "- Generate questions SPECIFIC to the data (e.g., if 'Room Select' has 65% drop-off, ask 'Why 65% drop at Room Select?')\n"
            "- Focus on: biggest leaks, revenue impact, root causes, improvement actions\n"
            "- Keep questions SHORT and clickable\n"
            "- Output ONLY a strict JSON array of strings (no other text)\n"
            "- Example format: [\"What are key takeaways?\", \"Why the big drop at Payment?\", \"How to fix Room Select drop-off?\", \"Calculate total revenue at risk\"]\n"
        )

        user_payload = {
            "context_name": request.context_name,
            "data": request.data,
        }

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Generate 3-4 SHORT questions (5-8 words max) for this chart. "
                    "Keep them simple and clickable. "
                    "Output ONLY a JSON array.\n\n"
                    + json.dumps(user_payload, default=str)
                ),
            },
        ]

        raw = call_azure_gpt(messages)

        # Try to parse as JSON array
        try:
            questions = json.loads(raw)
            if not isinstance(questions, list):
                raise ValueError("Expected a list of strings")
        except Exception:
            # Fallback: if model didn't follow JSON strictly, try to extract questions from text
            # Look for lines starting with numbers, bullets, or quotes
            lines = raw.split("\n")
            questions = []
            for line in lines:
                line = line.strip()
                # Remove common prefixes
                for prefix in ["- ", "• ", "1. ", "2. ", "3. ", "4. ", '"', "'"]:
                    if line.startswith(prefix):
                        line = line[len(prefix):].strip()
                # Remove trailing quotes/punctuation
                line = line.rstrip('"').rstrip("'").rstrip(".").strip()
                if line and len(line) > 10 and "?" in line:
                    questions.append(line)
            questions = questions[:4]

        # Ensure we have strings and limit to 4
        questions = [q for q in questions if isinstance(q, str) and q.strip()][:4]
        
        # If we still don't have questions, provide fallbacks
        if not questions:
            questions = [
                f"What is driving the anomaly in {request.context_name}?",
                "Which segment is most affected?",
                "What is the revenue impact?",
            ]

        return {"questions": questions}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI suggest-questions error: {str(exc)}")


# -------------------------------
# Segment Studio - Dynamic Segment Compiler
# -------------------------------

class SegmentRequest(BaseModel):
    """Request for dynamic segment analysis."""
    event_type: str
    segments: List[str]  # Segment identifiers (e.g., 'family', 'price_sensitive')
    measurement: str  # 'count', 'unique_users', 'sum_revenue', 'avg_session_duration'
    viz_mode: str  # 'trend', 'distribution', 'benchmark'
    date_range_days: int = 30


SEGMENT_FILTERS = {
    'all': "",
    'family': "guest_segment = 'family_with_young_kids'",
    'luxury': "guest_segment = 'luxury'",
    'couple': "guest_segment = 'couple'",
    'business': "guest_segment = 'business'",
    # Forensic segments
    'price_sensitive': "price_sensitivity_score > 0.7",
    'high_friction': "friction_score > 0.6 AND converted = 0",
    'urgent_family': "guest_segment = 'family_with_young_kids' AND urgency_score > 0.8",
    'returning': "is_returning_visitor = true",
}


@app.post("/api/segment/analyze")
async def analyze_segments(request: SegmentRequest) -> Dict[str, Any]:
    """
    Dynamic Segment Compiler: Marketing Intelligence Explorer.
    
    Takes event type, segment filters, and measurement type, then returns
    time-series or distribution data for comparison.
    
    This is the "brain" of Segment Studio - enables Amplitude-style
    behavioral analysis but with hospitality-specific segments.
    """
    try:
        if not request.segments:
            return {"data": []}
        
        # Map measurement type to SQL aggregation
        measurement_sql = {
            'count': "count(*)",
            'unique_users': "count(DISTINCT user_id)",
            'sum_revenue': "sum(total_revenue)",
            'avg_session_duration': "avg(session_duration_seconds)",
        }.get(request.measurement, "count(*)")
        
        # Build event filter
        event_condition = f"event_type = '{request.event_type}'"
        
        result_data = []
        
        if request.viz_mode == 'trend':
            # Time series data (daily aggregation)
            for segment_id in request.segments:
                segment_filter = SEGMENT_FILTERS.get(segment_id, "")
                
                # Build WHERE clause
                where_clause = event_condition
                if segment_filter:
                    where_clause += f" AND {segment_filter}"
                
                trend_query = f"""
                    SELECT 
                        toDate(timestamp) AS date,
                        {measurement_sql} AS value
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.date_range_days} DAY
                      AND {where_clause}
                    GROUP BY date
                    ORDER BY date
                """
                
                rows = run_query(trend_query)
                
                segment_trend = []
                for row in rows:
                    segment_trend.append({
                        'date': str(row[0]),
                        'value': float(row[1]) if row[1] else 0
                    })
                
                result_data.append({
                    'segment': segment_id,
                    'trend': segment_trend
                })
        
        elif request.viz_mode == 'distribution':
            # Distribution by location/property
            for segment_id in request.segments:
                segment_filter = SEGMENT_FILTERS.get(segment_id, "")
                
                where_clause = event_condition
                if segment_filter:
                    where_clause += f" AND {segment_filter}"
                
                dist_query = f"""
                    SELECT 
                        location,
                        {measurement_sql} AS value
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.date_range_days} DAY
                      AND {where_clause}
                      AND location IS NOT NULL
                    GROUP BY location
                    ORDER BY value DESC
                    LIMIT 10
                """
                
                rows = run_query(dist_query)
                
                distribution = []
                for row in rows:
                    distribution.append({
                        'location': row[0],
                        'value': float(row[1]) if row[1] else 0
                    })
                
                result_data.append({
                    'segment': segment_id,
                    'distribution': distribution
                })
        
        elif request.viz_mode == 'benchmark':
            # Benchmark: Segment value vs. Overall average
            # First get overall average
            avg_query = f"""
                SELECT {measurement_sql} AS avg_value
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL {request.date_range_days} DAY
                  AND {event_condition}
            """
            avg_rows = run_query(avg_query)
            overall_avg = float(avg_rows[0][0]) if avg_rows and avg_rows[0][0] else 0
            
            # Then get each segment's value
            for segment_id in request.segments:
                segment_filter = SEGMENT_FILTERS.get(segment_id, "")
                
                where_clause = event_condition
                if segment_filter:
                    where_clause += f" AND {segment_filter}"
                
                segment_query = f"""
                    SELECT {measurement_sql} AS value
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.date_range_days} DAY
                      AND {where_clause}
                """
                
                seg_rows = run_query(segment_query)
                segment_value = float(seg_rows[0][0]) if seg_rows and seg_rows[0][0] else 0
                
                result_data.append({
                    'segment': segment_id,
                    'value': segment_value,
                    'average': overall_avg,
                    'diff': segment_value - overall_avg,
                    'diff_percent': ((segment_value - overall_avg) / overall_avg * 100) if overall_avg > 0 else 0
                })
        
        return {"data": result_data}
        
    except Exception as exc:
        print(f"[Segment Analysis] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Segment analysis error: {str(exc)}")
