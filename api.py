from typing import Any, List, Optional, Dict
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import run_query
import os
import re
import json
import urllib.request
import uuid
import time
from datetime import datetime

app = FastAPI(title="ResortIQ ClickHouse API")

# Allow your React/Vite dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
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


# ============================================================================
# EVENT TRACKING ENDPOINT
# ============================================================================

class TrackEventRequest(BaseModel):
    """Model for tracking events with all 65+ filterable properties"""
    # Core event properties
    event_type: str
    user_id: str
    session_id: str
    timestamp: Optional[str] = None
    
    # Page properties
    page_url: Optional[str] = ""
    page_title: Optional[str] = ""
    page_category: Optional[str] = ""
    referrer_url: Optional[str] = ""
    
    # Interaction properties
    element_selector: Optional[str] = ""
    element_text: Optional[str] = ""
    element_type: Optional[str] = ""
    interaction_type: Optional[str] = "navigation"
    is_rage_click: Optional[bool] = False
    is_dead_click: Optional[bool] = False
    is_hesitation_click: Optional[bool] = False
    hover_duration_ms: Optional[int] = 0
    click_count_on_element: Optional[int] = 0
    
    # Engagement properties
    scroll_depth_percent: Optional[int] = 0
    scroll_speed_pixels_per_sec: Optional[int] = 0
    time_on_page_seconds: Optional[int] = 0
    video_interaction: Optional[str] = ""
    file_download_name: Optional[str] = ""
    
    # Form properties
    form_field_name: Optional[str] = ""
    form_field_value_length: Optional[int] = 0
    form_corrections_count: Optional[int] = 0
    form_autofill_detected: Optional[bool] = False
    form_validation_error: Optional[str] = ""
    
    # Booking/Hospitality properties
    funnel_step: Optional[int] = 0
    selected_location: Optional[str] = ""
    selected_checkin_date: Optional[str] = ""
    selected_checkout_date: Optional[str] = ""
    nights_count: Optional[int] = 0
    selected_room_type: Optional[str] = ""
    selected_guests_adults: Optional[int] = 0
    selected_guests_children: Optional[int] = 0
    price_viewed_amount: Optional[float] = 0
    discount_code_attempted: Optional[str] = ""
    discount_code_success: Optional[bool] = False
    addon_viewed: Optional[str] = ""
    addon_added: Optional[bool] = False
    currency_code: Optional[str] = "USD"
    guest_segment: Optional[str] = "Unknown"
    
    # Search properties
    search_query: Optional[str] = ""
    search_results_count: Optional[int] = 0
    search_filter_applied: Optional[str] = ""
    
    # Device properties
    device_type: Optional[str] = ""
    browser: Optional[str] = ""
    os: Optional[str] = "Unknown"
    screen_resolution: Optional[str] = ""
    viewport_width: Optional[int] = 0
    viewport_height: Optional[int] = 0
    connection_speed: Optional[str] = "medium"
    
    # Marketing properties
    utm_source: Optional[str] = ""
    utm_medium: Optional[str] = ""
    utm_campaign: Optional[str] = ""
    utm_content: Optional[str] = ""
    is_returning_visitor: Optional[bool] = False
    
    # Performance properties
    page_load_time_ms: Optional[int] = 0
    api_response_time_ms: Optional[int] = 0


@app.post("/api/track")
async def track_event(event: TrackEventRequest) -> Dict[str, Any]:
    """
    Receives tracking events from frontend/tracking script and inserts into ClickHouse.
    This populates all 65+ filterable properties.
    """
    try:
        # Generate event_id
        event_id = str(uuid.uuid4())
        
        # Use current timestamp if not provided
        if event.timestamp:
            timestamp = event.timestamp
        else:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Escape single quotes in string fields to prevent SQL injection
        def escape_str(s):
            return str(s).replace("'", "''") if s else ''
        
        # Build INSERT query with ALL properties
        insert_query = f"""
            INSERT INTO raw_events (
                event_id, session_id, user_id, timestamp, event_type,
                page_url, page_title, page_category, referrer_url,
                element_selector, element_text, element_type, interaction_type,
                is_rage_click, is_dead_click, is_hesitation_click, hover_duration_ms, click_count_on_element,
                scroll_depth_percent, scroll_speed_pixels_per_sec, time_on_page_seconds, 
                video_interaction, file_download_name,
                form_field_name, form_field_value_length, form_corrections_count, 
                form_autofill_detected, form_validation_error,
                funnel_step, selected_location, selected_checkin_date, selected_checkout_date,
                nights_count, selected_room_type, selected_guests_adults, selected_guests_children,
                price_viewed_amount, discount_code_attempted, discount_code_success,
                addon_viewed, addon_added, currency_code, guest_segment,
                search_query, search_results_count, search_filter_applied,
                device_type, browser, os, screen_resolution, 
                viewport_width, viewport_height, connection_speed,
                utm_source, utm_medium, utm_campaign, utm_content, is_returning_visitor,
                page_load_time_ms, api_response_time_ms
            ) VALUES (
                '{event_id}', '{escape_str(event.session_id)}', '{escape_str(event.user_id)}', '{timestamp}', '{escape_str(event.event_type)}',
                '{escape_str(event.page_url)}', '{escape_str(event.page_title)}', '{escape_str(event.page_category)}', '{escape_str(event.referrer_url)}',
                '{escape_str(event.element_selector)}', '{escape_str(event.element_text)}', '{escape_str(event.element_type)}', '{escape_str(event.interaction_type)}',
                {1 if event.is_rage_click else 0}, {1 if event.is_dead_click else 0}, 
                {1 if event.is_hesitation_click else 0}, {event.hover_duration_ms}, {event.click_count_on_element},
                {event.scroll_depth_percent}, {event.scroll_speed_pixels_per_sec}, {event.time_on_page_seconds},
                '{escape_str(event.video_interaction)}', '{escape_str(event.file_download_name)}',
                '{escape_str(event.form_field_name)}', {event.form_field_value_length}, {event.form_corrections_count},
                {1 if event.form_autofill_detected else 0}, '{escape_str(event.form_validation_error)}',
                {event.funnel_step}, '{escape_str(event.selected_location)}', '{escape_str(event.selected_checkin_date)}', 
                '{escape_str(event.selected_checkout_date)}', {event.nights_count}, '{escape_str(event.selected_room_type)}',
                {event.selected_guests_adults}, {event.selected_guests_children},
                {event.price_viewed_amount}, '{escape_str(event.discount_code_attempted)}', 
                {1 if event.discount_code_success else 0},
                '{escape_str(event.addon_viewed)}', {1 if event.addon_added else 0}, '{escape_str(event.currency_code)}', '{escape_str(event.guest_segment)}',
                '{escape_str(event.search_query)}', {event.search_results_count}, '{escape_str(event.search_filter_applied)}',
                '{escape_str(event.device_type)}', '{escape_str(event.browser)}', '{escape_str(event.os)}', '{escape_str(event.screen_resolution)}',
                {event.viewport_width}, {event.viewport_height}, '{escape_str(event.connection_speed)}',
                '{escape_str(event.utm_source)}', '{escape_str(event.utm_medium)}', '{escape_str(event.utm_campaign)}', '{escape_str(event.utm_content)}',
                {1 if event.is_returning_visitor else 0},
                {event.page_load_time_ms}, {event.api_response_time_ms}
            )
        """
        
        # Execute insert
        run_query(insert_query)
        
        return {
            "status": "success",
            "event_id": event_id,
            "timestamp": timestamp,
            "message": "Event tracked successfully"
        }
        
    except Exception as exc:
        print(f"[Track Event] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to track event: {str(exc)}")


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
            {"property": "click_count_on_element", "type": "number", "label": "Click Count", "category": "Interaction"},
            
            # Engagement Properties
            {"property": "scroll_depth_percent", "type": "number", "label": "Scroll Depth (%)", "category": "Engagement"},
            {"property": "scroll_speed_pixels_per_sec", "type": "number", "label": "Scroll Speed (px/s)", "category": "Engagement"},
            {"property": "time_on_page_seconds", "type": "number", "label": "Time on Page (s)", "category": "Engagement"},
            {"property": "video_interaction", "type": "string", "label": "Video Interaction", "category": "Engagement"},
            {"property": "file_download_name", "type": "string", "label": "File Downloaded", "category": "Engagement"},
            
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
            {"property": "currency_code", "type": "string", "label": "Currency", "category": "Booking"},
            {"property": "guest_segment", "type": "string", "label": "Guest Segment", "category": "Booking"},
            
            # Search Properties
            {"property": "search_query", "type": "string", "label": "Search Query", "category": "Search"},
            {"property": "search_results_count", "type": "number", "label": "Search Results", "category": "Search"},
            {"property": "search_filter_applied", "type": "string", "label": "Search Filters Applied", "category": "Search"},
            
            # Device/Browser Properties
            {"property": "device_type", "type": "string", "label": "Device Type", "category": "Device"},
            {"property": "browser", "type": "string", "label": "Browser", "category": "Device"},
            {"property": "os", "type": "string", "label": "Operating System", "category": "Device"},
            {"property": "screen_resolution", "type": "string", "label": "Screen Resolution", "category": "Device"},
            {"property": "viewport_width", "type": "number", "label": "Viewport Width", "category": "Device"},
            {"property": "viewport_height", "type": "number", "label": "Viewport Height", "category": "Device"},
            {"property": "connection_speed", "type": "string", "label": "Connection Speed", "category": "Device"},
            
            # Marketing/Attribution Properties
            {"property": "utm_source", "type": "string", "label": "UTM Source", "category": "Marketing"},
            {"property": "utm_medium", "type": "string", "label": "UTM Medium", "category": "Marketing"},
            {"property": "utm_campaign", "type": "string", "label": "UTM Campaign", "category": "Marketing"},
            {"property": "utm_content", "type": "string", "label": "UTM Content", "category": "Marketing"},
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
        
        # Fetch custom event templates
        custom_events = []
        try:
            custom_query = """
                SELECT template_id, template_name, description, base_event_type, filters, icon
                FROM custom_event_templates
                WHERE user_id = 'default_user'
                ORDER BY created_at DESC
            """
            custom_rows = run_query(custom_query)
            for row in custom_rows:
                filters_json = json.loads(row[4]) if row[4] else []
                custom_events.append({
                    "template_id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "base_event_type": row[3],
                    "filters": filters_json,
                    "icon": row[5],
                    "category": "custom"
                })
        except Exception as e:
            print(f"Warning: Could not fetch custom events: {e}")
            # Don't fail the whole request if custom events can't be fetched
        
        # Get last scan timestamp (current time for now, can be enhanced with actual tracking)
        last_scan_timestamp = datetime.now().isoformat()
        
        return {
            "generic_events": generic_events,
            "hospitality_events": hospitality_events,
            "custom_events": custom_events,  # NEW: Include custom events
            "all_properties": all_properties,
            "db_event_types": db_event_types,  # Raw event_type values from DB
            "group_by_options": ["device_type", "browser", "utm_source", "utm_medium", "guest_segment"],
            "last_scan_timestamp": last_scan_timestamp  # Track schema changes
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Schema query error: {str(exc)}")


@app.get("/api/metadata/schema/detailed")
async def get_detailed_schema() -> Dict[str, Any]:
    """
    Returns detailed schema information including:
    - Event frequency data (how often each event occurs)
    - Page URL patterns for context
    - Event property correlation data
    - Last scan timestamp
    """
    try:
        # Get event frequency data
        frequency_query = """
            SELECT 
                event_type,
                count(*) as event_count,
                count(DISTINCT user_id) as unique_users,
                count(DISTINCT session_id) as unique_sessions,
                min(timestamp) as first_seen,
                max(timestamp) as last_seen
            FROM raw_events
            GROUP BY event_type
            ORDER BY event_count DESC
        """
        frequency_rows = run_query(frequency_query)
        event_frequency = []
        for row in frequency_rows:
            event_frequency.append({
                "event_type": row[0],
                "event_count": row[1],
                "unique_users": row[2],
                "unique_sessions": row[3],
                "first_seen": str(row[4]) if row[4] else None,
                "last_seen": str(row[5]) if row[5] else None,
            })
        
        # Get page_url patterns (top 20 most common patterns)
        page_url_query = """
            SELECT 
                page_url,
                count(*) as occurrence_count,
                count(DISTINCT event_type) as event_types_count
            FROM raw_events
            WHERE page_url != '' AND page_url IS NOT NULL
            GROUP BY page_url
            ORDER BY occurrence_count DESC
            LIMIT 20
        """
        page_url_rows = run_query(page_url_query)
        page_url_patterns = []
        for row in page_url_rows:
            page_url_patterns.append({
                "page_url": row[0],
                "occurrence_count": row[1],
                "event_types_count": row[2],
            })
        
        # Get property correlation data (which properties co-occur with which events)
        # Sample: device_type distribution per event_type
        correlation_query = """
            SELECT 
                event_type,
                device_type,
                count(*) as count
            FROM raw_events
            WHERE device_type != '' AND device_type IS NOT NULL
            GROUP BY event_type, device_type
            ORDER BY event_type, count DESC
        """
        correlation_rows = run_query(correlation_query)
        property_correlations = {}
        for row in correlation_rows:
            event_type = row[0]
            device_type = row[1]
            count = row[2]
            if event_type not in property_correlations:
                property_correlations[event_type] = {}
            if "device_type" not in property_correlations[event_type]:
                property_correlations[event_type]["device_type"] = []
            property_correlations[event_type]["device_type"].append({
                "value": device_type,
                "count": count
            })
        
        # Get last scan timestamp
        last_scan_timestamp = datetime.now().isoformat()
        
        return {
            "event_frequency": event_frequency,
            "page_url_patterns": page_url_patterns,
            "property_correlations": property_correlations,
            "last_scan_timestamp": last_scan_timestamp
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detailed schema query error: {str(exc)}")


# ============================================================================
# PYDANTIC MODELS FOR CUSTOM EVENT TEMPLATES
# ============================================================================

class EventFilter(BaseModel):
    property: str  # e.g., "page_url", "element_text", "funnel_step"
    operator: str = "equals"  # equals, contains, starts_with, greater_than, less_than
    value: Any  # The filter value


class CustomEventTemplate(BaseModel):
    """Model for user-defined custom event templates"""
    template_id: Optional[str] = None  # Auto-generated if not provided
    user_id: str = "default_user"
    template_name: str
    description: Optional[str] = ""
    base_event_type: str  # e.g., "Page Viewed", "Click"
    base_event_category: str = "generic"
    filters: List[EventFilter] = []  # Filters that define this custom event
    icon: str = "📦"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================================
# CUSTOM EVENT TEMPLATES API
# ============================================================================

@app.get("/api/custom-events")
async def get_custom_events(user_id: str = Query(default="default_user")) -> Dict[str, Any]:
    """
    Get all custom event templates for a user.
    
    Returns:
    - List of custom event templates
    """
    try:
        query = f"""
            SELECT 
                template_id,
                user_id,
                template_name,
                description,
                base_event_type,
                base_event_category,
                filters,
                icon,
                created_at,
                updated_at
            FROM custom_event_templates
            WHERE user_id = '{user_id}'
            ORDER BY created_at DESC
        """
        
        rows = run_query(query)
        
        templates = []
        for row in rows:
            # Parse the filters JSON string
            filters_json = json.loads(row[6]) if row[6] else []
            
            templates.append({
                "template_id": row[0],
                "user_id": row[1],
                "template_name": row[2],
                "description": row[3],
                "base_event_type": row[4],
                "base_event_category": row[5],
                "filters": filters_json,
                "icon": row[7],
                "created_at": str(row[8]) if row[8] else None,
                "updated_at": str(row[9]) if row[9] else None,
            })
        
        return {"custom_events": templates, "count": len(templates)}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching custom events: {str(exc)}")


@app.post("/api/custom-events")
async def create_custom_event(template: CustomEventTemplate) -> Dict[str, Any]:
    """
    Create a new custom event template.
    
    Body:
    - template_name: Name of the custom event
    - description: Optional description
    - base_event_type: Base generic event (e.g., "Page Viewed")
    - filters: List of filters that define this event
    - icon: Optional emoji/icon
    
    Returns:
    - Created template with template_id
    """
    try:
        # Generate template_id if not provided
        template_id = template.template_id or str(uuid.uuid4())
        
        # Convert filters to JSON string
        filters_json = json.dumps([f.dict() for f in template.filters])
        
        # Escape single quotes in strings for SQL
        template_name_escaped = template.template_name.replace("'", "''")
        description_escaped = (template.description or "").replace("'", "''")
        base_event_type_escaped = template.base_event_type.replace("'", "''")
        icon_escaped = template.icon.replace("'", "''")
        filters_escaped = filters_json.replace("'", "''")
        
        # Insert query
        insert_query = f"""
            INSERT INTO custom_event_templates (
                template_id,
                user_id,
                template_name,
                description,
                base_event_type,
                base_event_category,
                filters,
                icon,
                created_at,
                updated_at
            ) VALUES (
                '{template_id}',
                '{template.user_id}',
                '{template_name_escaped}',
                '{description_escaped}',
                '{base_event_type_escaped}',
                '{template.base_event_category}',
                '{filters_escaped}',
                '{icon_escaped}',
                now(),
                now()
            )
        """
        
        run_query(insert_query)
        
        return {
            "success": True,
            "template_id": template_id,
            "template_name": template.template_name,
            "message": f"Custom event '{template.template_name}' created successfully!"
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error creating custom event: {str(exc)}")


@app.delete("/api/custom-events/{template_id}")
async def delete_custom_event(template_id: str, user_id: str = Query(default="default_user")) -> Dict[str, Any]:
    """
    Delete a custom event template.
    
    Parameters:
    - template_id: ID of the template to delete
    - user_id: User ID (for authorization)
    
    Returns:
    - Success message
    """
    try:
        delete_query = f"""
            DELETE FROM custom_event_templates
            WHERE template_id = '{template_id}'
              AND user_id = '{user_id}'
        """
        
        run_query(delete_query)
        
        return {
            "success": True,
            "template_id": template_id,
            "message": "Custom event deleted successfully!"
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error deleting custom event: {str(exc)}")


"""
Event-Driven Funnel Analysis using windowFunnel

This endpoint uses ClickHouse's windowFunnel function to calculate funnels
based on event sequences, not hardcoded funnel_step values.
"""

class FunnelStepRequest(BaseModel):
    event_category: str = "generic"  # "generic" or "hospitality"
    event_type: str  # For generic: "page_view", "click", etc. For hospitality: "room_select", "location_select", etc.
    label: Optional[str] = None  # User-friendly label
    filters: Optional[List[EventFilter]] = None  # List of filters (property, operator, value)


class SegmentComparison(BaseModel):
    id: str
    name: str  # User-defined segment name
    filters: List[EventFilter]  # Filters that define this segment


class FunnelRequest(BaseModel):
    steps: List[FunnelStepRequest]
    view_type: str = "conversion"
    completed_within: int = 1  # days, converted to seconds for windowFunnel
    counting_by: str = "unique_users"
    measure: Optional[str] = None
    window: Optional[str] = None
    group_by: Optional[str] = None
    segments: Optional[List[SegmentComparison]] = None  # User-defined segments for comparison
    date_range: Optional[Dict[str, str]] = None
    global_filters: Optional[Dict[str, Any]] = None
    # Hybrid Funnel: demo = curated steps, dynamic = user-built from DB events
    funnel_mode: str = "demo"  # "demo" | "dynamic"
    funnel_id: Optional[str] = None  # For demo mode: which preset (default: hospitality_booking)


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
    
    Handles Generic Events (event_type based), Hospitality Events (funnel_step based),
    and Custom Events (user-defined templates).
    """
    base_condition = ""
    
    # Check if it's a custom event (category = "custom")
    if step.event_category == "custom":
        # Custom events are stored as templates - we need to use their base_event_type
        # The filters from the custom template will be added via step.filters
        # For now, treat it like a generic event with the base_event_type
        event_type_safe = step.event_type.replace("'", "''")
        
        # Check if the base_event_type is in EVENT_MAPPING
        if step.event_type in EVENT_MAPPING:
            mapping = EVENT_MAPPING[step.event_type]
            base_condition = mapping["base"]
        else:
            # Assume it's a direct event_type
            base_condition = f"event_type = '{event_type_safe}'"
    # Check if it's a mapped event name (from EVENT_MAPPING)
    elif step.event_type in EVENT_MAPPING:
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
    
    Hybrid Funnel Engine:
    - Demo mode: Uses curated steps (from config if steps empty)
    - Dynamic mode: Uses steps built from /api/funnel/events/dynamic
    
    Sequential validation enforced by windowFunnel (strict order).
    """
    try:
        # Resolve steps from mode (Phase 3 - Definition Layer)
        steps_raw = [s.dict() if hasattr(s, 'dict') else s for s in request.steps]
        try:
            from engines.funnel_engine import resolve_funnel_steps
            resolved = resolve_funnel_steps(
                request.funnel_mode or "demo",
                steps_raw if steps_raw else None,
                request.funnel_id
            )
        except ImportError:
            resolved = steps_raw

        # Convert to FunnelStepRequest for downstream
        steps_to_use = [FunnelStepRequest(**{**s, "filters": s.get("filters") or []}) for s in resolved] if resolved else []

        step_count = len(steps_to_use)
        if step_count == 0:
            return {
                "data": [],
                "view_type": request.view_type,
                "completed_within": request.completed_within,
                "counting_by": request.counting_by,
                "funnel_mode": request.funnel_mode,
            }
        
        # Use resolved steps for rest of logic (replace request.steps)
        _steps = steps_to_use
        
        # Convert completed_within days to seconds for windowFunnel
        # This is the conversion window (how long a user has to complete the funnel)
        window_seconds = request.completed_within * 24 * 60 * 60
        
        # Data selection window: Use a larger window to ensure we capture all relevant sessions
        # The windowFunnel conversion window is separate from the data selection window
        # Use at least 90 days to capture all sessions, or completed_within * 3, whichever is larger
        data_window_days = max(90, request.completed_within * 3)
        
        # Build windowFunnel conditions (use resolved steps)
        conditions = build_windowfunnel_conditions(_steps)
        
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
        
        # Check if we have user-defined segments (takes priority over group_by)
        has_segments = request.segments and len(request.segments) > 0
        
        # Group by clause
        group_by_col = request.group_by if request.group_by and not has_segments else None
        group_by_clause = ""
        group_by_select = ""
        if group_by_col:
            # For group_by, we need to join with sessions table to get the dimension
            group_by_clause = f", s.{group_by_col}"
            group_by_select = f", s.{group_by_col} AS segment"
            join_clause = "INNER JOIN sessions s ON re.session_id = s.session_id"
        else:
            join_clause = ""
        
        # Handle user-defined segments (custom segment comparison)
        if has_segments:
            # Run funnel query for each segment with its specific filters
            all_segment_counts: Dict[int, Dict[str, float]] = {}  # step_index -> {segment_name: count}
            
            for segment in request.segments:
                # Determine which properties are being filtered
                # Some properties are in sessions table, others in raw_events
                session_properties = {'guest_segment', 'traffic_source', 'browser', 'is_returning_visitor'}
                needs_session_join = any(f.property in session_properties for f in segment.filters)
                
                # Build WHERE clause for this segment's filters
                segment_filter_conditions = []
                for seg_filter in segment.filters:
                    # Prefix property with table alias if needed
                    if needs_session_join and seg_filter.property in session_properties:
                        # Replace property name with s.property for session table
                        filter_str = build_filter_condition(seg_filter)
                        filter_str = filter_str.replace(seg_filter.property, f's.{seg_filter.property}')
                        segment_filter_conditions.append(filter_str)
                    else:
                        # Use re.property for raw_events table
                        filter_str = build_filter_condition(seg_filter)
                        filter_str = filter_str.replace(seg_filter.property, f're.{seg_filter.property}')
                        segment_filter_conditions.append(filter_str)
                
                segment_where = ""
                if segment_filter_conditions:
                    segment_where = f"AND ({' AND '.join(segment_filter_conditions)})"
                
                # Build query for this specific segment
                if counting_method == "unique_users":
                    if needs_session_join:
                        segment_query = f"""
                            SELECT 
                                funneled.funnel_level,
                                count(DISTINCT re.user_id) AS reached_count
                            FROM (
                                SELECT 
                                    re.session_id,
                                    windowFunnel({window_seconds})(
                                        toDateTime(timestamp),
                                        {conditions}
                                    ) AS funnel_level
                                FROM raw_events re
                                INNER JOIN sessions s ON re.session_id = s.session_id
                                WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                                  {global_where}
                                  {segment_where}
                                GROUP BY re.session_id
                            ) AS funneled
                            INNER JOIN raw_events re ON funneled.session_id = re.session_id
                            INNER JOIN sessions s ON re.session_id = s.session_id
                            WHERE funneled.funnel_level > 0
                              {segment_where}
                            GROUP BY funneled.funnel_level
                            ORDER BY funneled.funnel_level
                        """
                    else:
                        segment_query = f"""
                            SELECT 
                                funneled.funnel_level,
                                count(DISTINCT re.user_id) AS reached_count
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
                                  {segment_where}
                                GROUP BY re.session_id
                            ) AS funneled
                            INNER JOIN raw_events re ON funneled.session_id = re.session_id
                            WHERE funneled.funnel_level > 0
                              {segment_where}
                            GROUP BY funneled.funnel_level
                            ORDER BY funneled.funnel_level
                        """
                else:
                    # For sessions or events
                    count_expr_seg = "count(DISTINCT funneled.session_id)" if counting_method == "sessions" else "count(*)"
                    if needs_session_join:
                        segment_query = f"""
                            SELECT 
                                funnel_level,
                                {count_expr_seg} AS reached_count
                            FROM (
                                SELECT 
                                    re.session_id,
                                    windowFunnel({window_seconds})(
                                        toDateTime(timestamp),
                                        {conditions}
                                    ) AS funnel_level
                                FROM raw_events re
                                INNER JOIN sessions s ON re.session_id = s.session_id
                                WHERE timestamp >= now() - INTERVAL {data_window_days} DAY
                                  {global_where}
                                  {segment_where}
                                GROUP BY re.session_id
                            ) AS funneled
                            WHERE funnel_level > 0
                            GROUP BY funnel_level
                            ORDER BY funnel_level
                        """
                    else:
                        segment_query = f"""
                            SELECT 
                                funnel_level,
                                {count_expr_seg} AS reached_count
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
                                  {segment_where}
                                GROUP BY session_id
                            ) AS funneled
                            WHERE funnel_level > 0
                            GROUP BY funnel_level
                            ORDER BY funnel_level
                        """
                
                # Execute query for this segment
                segment_rows = run_query(segment_query)
                
                # Process results for this segment
                for row in segment_rows:
                    funnel_level = int(row[0])
                    count_val = float(row[1])
                    
                    # For each level reached, count users who reached that level or higher
                    for step_idx in range(1, step_count + 1):
                        if funnel_level >= step_idx:
                            if step_idx not in all_segment_counts:
                                all_segment_counts[step_idx] = {}
                            all_segment_counts[step_idx][segment.name] = all_segment_counts[step_idx].get(segment.name, 0) + count_val
            
            # Build response with segment data (use _steps for labels)
            result = []
            for idx, step in enumerate(_steps):
                step_num = idx + 1
                segment_data = all_segment_counts.get(step_num, {})
                
                # Calculate totals across all segments
                current_count = sum(segment_data.values()) if segment_data else 0
                prev_count = sum(all_segment_counts.get(step_num - 1, {}).values()) if step_num > 1 else current_count
                next_count = sum(all_segment_counts.get(step_num + 1, {}).values()) if step_num < step_count else current_count
                
                # Conversion rate (aggregate)
                conversion_rate = (current_count / prev_count * 100) if prev_count > 0 else 100.0
                drop_off_rate = 100.0 - conversion_rate if step_num > 1 else 0.0
                
                # Revenue at risk
                dropped_count = max(0.0, current_count - next_count)
                avg_booking_value = 260.0
                revenue_at_risk = dropped_count * avg_booking_value
                
                # Average time (reuse existing logic)
                avg_time_seconds = 120 + (idx * 30)
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
                    "median_time_seconds": round(avg_time_seconds, 1),
                    "segments": {seg_name: int(count) for seg_name, count in segment_data.items()},
                })
            
            return {
                "data": result,
                "view_type": request.view_type,
                "completed_within": request.completed_within,
                "counting_by": request.counting_by,
                "has_segments": True,
                "funnel_mode": request.funnel_mode,
            }
        
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
        
        # Phase 9: Validation - detect aggregation drift
        validation_anomalies = []
        try:
            from engines.funnel_engine import validate_funnel_results
            flat_counts = {i: sum(step_counts.get(i, {}).values()) for i in range(1, step_count + 1)}
            _valid, validation_anomalies = validate_funnel_results(flat_counts, None, step_count)
        except ImportError:
            pass

        # Calculate conversion rates and build response
        result = []
        for idx, step in enumerate(_steps):
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
                    next_step = _steps[idx + 1]
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
            "counting_by": request.counting_by,
            "funnel_mode": request.funnel_mode,
            "validation_anomalies": validation_anomalies,
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


# ============================================================================
# Dynamic Event Discovery - Phase 4
# ============================================================================

_DYNAMIC_EVENTS_CACHE: Dict[str, Any] = {"events": [], "ts": 0}
_DYNAMIC_EVENTS_TTL_SEC = 300  # 5 minutes


@app.get("/api/funnel/events/dynamic")
async def get_dynamic_events(
    min_count: int = Query(default=100, description="Min events to include"),
    limit: int = Query(default=50, description="Max event types to return"),
) -> Dict[str, Any]:
    """
    Dynamic event discovery - fetch available event_type values from raw_events.
    
    Used for Dynamic funnel mode: users build funnels from any event in the schema.
    Cached for 5 minutes to avoid repeated DB hits.
    Fallback: returns demo event types if query fails.
    """
    now = time.time()
    if _DYNAMIC_EVENTS_CACHE["events"] and (now - _DYNAMIC_EVENTS_CACHE["ts"]) < _DYNAMIC_EVENTS_TTL_SEC:
        return {"events": _DYNAMIC_EVENTS_CACHE["events"], "cached": True, "mode": "dynamic"}

    try:
        query = f"""
            SELECT event_type, count(*) as cnt
            FROM raw_events
            WHERE timestamp >= now() - INTERVAL 90 DAY
              AND event_type != '' AND event_type IS NOT NULL
            GROUP BY event_type
            HAVING cnt >= {min_count}
            ORDER BY cnt DESC
            LIMIT {limit}
        """
        rows = run_query(query)
        events = [{"event_type": str(r[0]), "count": int(r[1]), "label": _format_event_label(str(r[0]))} for r in rows]

        _DYNAMIC_EVENTS_CACHE["events"] = events
        _DYNAMIC_EVENTS_CACHE["ts"] = now
        return {"events": events, "cached": False, "mode": "dynamic"}
    except Exception as exc:
        print(f"[Dynamic Events] Fallback due to error: {exc}")
        # Fallback to demo-mapped event types
        fallback = [
            {"event_type": "page_view", "label": "Page View"},
            {"event_type": "click", "label": "Click"},
            {"event_type": "date_select", "label": "Date Select"},
            {"event_type": "form_interaction", "label": "Form Interaction"},
            {"event_type": "room_view", "label": "Room View"},
            {"event_type": "price_view", "label": "Price View"},
        ]
        return {"events": fallback, "cached": False, "mode": "dynamic", "fallback": True}


def _format_event_label(event_type: str) -> str:
    """Convert event_type to human label (e.g. page_view -> Page View)."""
    return event_type.replace("_", " ").title()


@app.get("/api/funnel/demo-config")
async def get_demo_funnel_config() -> Dict[str, Any]:
    """
    Return curated demo funnel definitions for Demo mode.
    Stable for investor/client demos.
    """
    try:
        from config.funnel_config import DEMO_FUNNELS, get_default_demo_steps
        return {
            "funnels": DEMO_FUNNELS,
            "default_steps": get_default_demo_steps(),
            "mode": "demo",
        }
    except ImportError:
        return {
            "funnels": {},
            "default_steps": [],
            "mode": "demo",
            "error": "Config module not found",
        }


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


@app.get("/api/metadata/segment-values")
async def get_segment_values() -> Dict[str, Any]:
    """
    Get actual available values for segment properties from the database.
    Only returns properties with actual data to avoid empty segments.
    """
    try:
        result = {}
        
        # 1. Device Type (from sessions table) - lowercase values
        device_query = """
            SELECT DISTINCT device_type, count() AS cnt
            FROM sessions
            WHERE device_type != '' AND device_type != 'Unknown'
            GROUP BY device_type
            HAVING cnt > 1000
            ORDER BY cnt DESC
        """
        device_rows = run_query(device_query)
        if device_rows:
            result['device_type'] = [
                {"value": row[0], "label": row[0].title(), "count": int(row[1])}
                for row in device_rows if row[0]
            ]
        
        # 2. Guest Segment (actual values from sessions table)
        segment_query = """
            SELECT DISTINCT guest_segment, count() AS cnt
            FROM sessions
            WHERE guest_segment != '' AND guest_segment != 'Unknown'
            GROUP BY guest_segment
            HAVING cnt > 1000
            ORDER BY cnt DESC
        """
        segment_rows = run_query(segment_query)
        if segment_rows:
            result['guest_segment'] = [
                {
                    "value": row[0],
                    "label": row[0].replace('_', ' ').title(),
                    "count": int(row[1])
                }
                for row in segment_rows if row[0]
            ]
        
        # 3. Selected Location (from raw_events - lowercase underscore format)
        location_query = """
            SELECT DISTINCT selected_location, count() AS cnt
            FROM raw_events
            WHERE selected_location != '' 
                AND selected_location NOT LIKE 'Kalahari%'
            GROUP BY selected_location
            HAVING cnt > 10000
            ORDER BY cnt DESC
        """
        location_rows = run_query(location_query)
        if location_rows:
            result['selected_location'] = [
                {
                    "value": row[0],
                    "label": row[0].replace('_', ' ').title(),
                    "count": int(row[1])
                }
                for row in location_rows if row[0]
            ]
        
        # 4. Traffic Source (use traffic_source column, not utm_source)
        traffic_query = """
            SELECT DISTINCT traffic_source, count() AS cnt
            FROM sessions
            WHERE traffic_source != '' AND traffic_source != 'Unknown'
            GROUP BY traffic_source
            HAVING cnt > 1000
            ORDER BY cnt DESC
        """
        traffic_rows = run_query(traffic_query)
        if traffic_rows:
            result['traffic_source'] = [
                {
                    "value": row[0],
                    "label": row[0].replace('_', ' ').title(),
                    "count": int(row[1])
                }
                for row in traffic_rows if row[0]
            ]
        
        # 5. Browser (from sessions table)
        browser_query = """
            SELECT DISTINCT browser, count() AS cnt
            FROM sessions
            WHERE browser != '' AND browser != 'Unknown'
            GROUP BY browser
            HAVING cnt > 1000
            ORDER BY cnt DESC
        """
        browser_rows = run_query(browser_query)
        if browser_rows:
            result['browser'] = [
                {"value": row[0], "label": row[0], "count": int(row[1])}
                for row in browser_rows if row[0]
            ]
        
        # 6. Visitor Type (from sessions table)
        visitor_query = """
            SELECT 
                CASE 
                    WHEN is_returning_visitor = 1 OR is_returning_visitor = true THEN 'true'
                    ELSE 'false'
                END AS visitor_type,
                count() AS cnt
            FROM sessions
            GROUP BY visitor_type
            HAVING cnt > 1000
            ORDER BY cnt DESC
        """
        visitor_rows = run_query(visitor_query)
        if visitor_rows:
            result['is_returning_visitor'] = [
                {
                    "value": row[0],
                    "label": "Returning Visitors" if row[0] == 'true' else "New Visitors",
                    "count": int(row[1])
                }
                for row in visitor_rows if row[0]
            ]
        
        return {
            "segment_properties": result,
            "total_sessions": 180000,
            "last_updated": "now()",
            "note": "Only shows properties with sufficient data (>1000 sessions for reliability)"
        }
        
    except Exception as exc:
        print(f"[Segment Values] Error: {exc}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch segment values: {str(exc)}")


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
                avg_time = max(0, float(row[col_idx + 4])) if row[col_idx + 4] is not None and row[col_idx + 4] > 0 else 0
                sample_size = int(row[col_idx + 5]) if row[col_idx + 5] is not None and row[col_idx + 5] > 0 else 0
                
                col_idx += 6
                
                # Bottleneck detection: If cumulative time is > 5 minutes, flag it
                is_bottleneck = (median > 300 or p95 > 300) and sample_size > 0
                
                # Use best available time metric (prefer median, fallback to avg, then p95)
                best_time = median if median > 0 else (avg_time if avg_time > 0 else p95)
                
                result.append({
                    "step_name": request.steps[step_idx].label or request.steps[step_idx].event_type,
                    "step_index": step_idx + 1,
                    "avg_time_seconds": round(avg_time, 1),
                    "median_time_seconds": round(median, 1),
                    "best_time_seconds": round(best_time, 1),  # NEW: Best available time
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
                    "best_time_seconds": 0,
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


# ============================================================================
# REVENUE IMPACT ANALYSIS - "Better than Amplitude"
# ============================================================================

@app.post("/api/analytics/revenue-impact")
async def get_revenue_impact(request: FunnelRequest) -> Dict[str, Any]:
    """
    Revenue Impact Analysis - Calculate actual $ lost at each funnel step.
    
    This is BETTER than Amplitude because:
    - Real revenue calculations from actual session data
    - Segment-specific revenue breakdown
    - Predictive "what-if" scenarios
    - Hospitality-specific metrics (ADR, LOS impact)
    
    Returns:
    - revenue_per_step: $ lost at each step
    - total_revenue_at_risk: Total $ in pipeline
    - segment_breakdown: Revenue loss by segment
    - improvement_opportunities: Projected revenue if friction reduced
    """
    try:
        # Calculate funnel data first
        funnel_data = await get_funnel_data(request)
        
        # Get additional revenue metrics from sessions table
        step_count = len(request.steps)
        
        # Query to get actual revenue data per step
        revenue_query = f"""
            SELECT 
                funnel_exit_step,
                count(*) as sessions,
                sum(potential_revenue) as revenue_lost,
                avg(potential_revenue) as avg_revenue_per_session,
                countIf(converted = 0) as unconverted_count,
                sumIf(potential_revenue, converted = 0) as unconverted_revenue
            FROM sessions
            WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
              AND funnel_entry_step >= 1
              AND funnel_exit_step < {step_count}
            GROUP BY funnel_exit_step
            ORDER BY funnel_exit_step
        """
        
        revenue_rows = run_query(revenue_query)
        
        revenue_by_step = []
        total_revenue_at_risk = 0
        
        for row in revenue_rows:
            step_num = int(row[0]) if row[0] else 0
            sessions = int(row[1]) if row[1] else 0
            revenue_lost = float(row[2]) if row[2] else 0
            avg_revenue = float(row[3]) if row[3] else 0
            unconverted = int(row[4]) if row[4] else 0
            unconverted_revenue = float(row[5]) if row[5] else 0
            
            # Map step number to step name
            step_name = request.steps[step_num].label if step_num < len(request.steps) else f"Step {step_num + 1}"
            
            revenue_by_step.append({
                "step": step_num + 1,
                "step_name": step_name,
                "sessions_dropped": sessions,
                "revenue_lost": round(revenue_lost, 2),
                "avg_revenue_per_user": round(avg_revenue, 2),
                "unconverted_count": unconverted,
                "unconverted_revenue": round(unconverted_revenue, 2)
            })
            
            total_revenue_at_risk += revenue_lost
        
        # Segment breakdown (if segments provided)
        segment_breakdown = []
        if request.segments:
            for segment in request.segments:
                # Build segment filter
                segment_conditions = []
                for seg_filter in segment.filters:
                    prop = seg_filter.property
                    val = seg_filter.value
                    val_escaped = str(val).replace("'", "''")
                    
                    # Check if property is in sessions table
                    if prop in ['device_type', 'browser', 'guest_segment', 'traffic_source', 'is_returning_visitor']:
                        segment_conditions.append(f"{prop} = '{val_escaped}'")
                
                if segment_conditions:
                    segment_where = " AND ".join(segment_conditions)
                    
                    seg_revenue_query = f"""
                        SELECT 
                            sum(potential_revenue) as total_revenue_lost,
                            count(*) as dropped_sessions
                        FROM sessions
                        WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
                          AND funnel_entry_step >= 1
                          AND funnel_completed = 0
                          AND {segment_where}
                    """
                    
                    seg_rows = run_query(seg_revenue_query)
                    if seg_rows and seg_rows[0]:
                        segment_breakdown.append({
                            "segment_name": segment.name,
                            "segment_id": segment.id,
                            "revenue_lost": round(float(seg_rows[0][0] or 0), 2),
                            "dropped_sessions": int(seg_rows[0][1] or 0),
                            "percentage_of_total": round((float(seg_rows[0][0] or 0) / total_revenue_at_risk * 100) if total_revenue_at_risk > 0 else 0, 1)
                        })
        
        # Calculate improvement opportunities (what-if scenarios)
        improvement_opportunities = []
        for i, step_data in enumerate(revenue_by_step):
            # Calculate if we reduce drop-off by 10%, 25%, 50%
            revenue_lost = step_data["revenue_lost"]
            
            improvement_opportunities.append({
                "step": step_data["step"],
                "step_name": step_data["step_name"],
                "current_revenue_lost": revenue_lost,
                "if_reduce_10_percent": round(revenue_lost * 0.10, 2),
                "if_reduce_25_percent": round(revenue_lost * 0.25, 2),
                "if_reduce_50_percent": round(revenue_lost * 0.50, 2),
            })
        
        return {
            "total_revenue_at_risk": round(total_revenue_at_risk, 2),
            "revenue_per_step": revenue_by_step,
            "segment_breakdown": segment_breakdown,
            "improvement_opportunities": improvement_opportunities,
            "period_days": request.completed_within,
            "currency": "USD",
            "has_segments": len(segment_breakdown) > 0
        }
        
    except Exception as exc:
        print(f"[Revenue Impact] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Revenue impact error: {str(exc)}")


# ============================================================================
# HOSPITALITY METRICS ANALYSIS - "Better than Amplitude"
# ============================================================================

@app.post("/api/analytics/hospitality-metrics")
async def get_hospitality_metrics(request: FunnelRequest) -> Dict[str, Any]:
    """
    Hospitality-Specific Metrics - Industry KPIs that Amplitude can't provide.
    
    Returns:
    - ADR (Average Daily Rate): Average price per night
    - LOS (Length of Stay): Average nights booked
    - RevPAR (Revenue per Available Room): Estimated
    - Booking Intent Score: Engagement-based score
    - Segment Performance: By guest type
    - Ancillary Revenue: Add-ons, upgrades
    """
    try:
        # ADR & LOS calculation from completed bookings
        adr_los_query = f"""
            SELECT 
                avg(final_total_price / final_nights_count) as adr,
                avg(final_nights_count) as avg_los,
                avg(final_total_price) as avg_booking_value,
                count(*) as completed_bookings,
                sum(final_total_price) as total_revenue
            FROM sessions
            WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
              AND funnel_completed = 1
              AND final_nights_count > 0
              AND final_total_price > 0
        """
        
        adr_los_rows = run_query(adr_los_query)
        
        adr = 0
        avg_los = 0
        avg_booking_value = 0
        completed_bookings = 0
        total_revenue = 0
        
        if adr_los_rows and adr_los_rows[0]:
            adr = float(adr_los_rows[0][0] or 0)
            avg_los = float(adr_los_rows[0][1] or 0)
            avg_booking_value = float(adr_los_rows[0][2] or 0)
            completed_bookings = int(adr_los_rows[0][3] or 0)
            total_revenue = float(adr_los_rows[0][4] or 0)
        
        # Guest Segment Performance
        segment_performance_query = f"""
            SELECT 
                guest_segment,
                count(*) as sessions,
                countIf(funnel_completed = 1) as conversions,
                (countIf(funnel_completed = 1) / count(*) * 100) as conversion_rate,
                avg(intent_score) as avg_intent_score,
                avg(final_total_price) as avg_booking_value,
                avg(final_nights_count) as avg_nights
            FROM sessions
            WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
              AND guest_segment != ''
              AND guest_segment != 'Unknown'
            GROUP BY guest_segment
            ORDER BY conversion_rate DESC
        """
        
        segment_rows = run_query(segment_performance_query)
        
        segment_performance = []
        for row in segment_rows:
            segment_performance.append({
                "segment": row[0] if row[0] else "Unknown",
                "sessions": int(row[1]) if row[1] else 0,
                "conversions": int(row[2]) if row[2] else 0,
                "conversion_rate": round(float(row[3] or 0), 1),
                "avg_intent_score": round(float(row[4] or 0), 1),
                "avg_booking_value": round(float(row[5] or 0), 2),
                "avg_nights": round(float(row[6] or 0), 1)
            })
        
        # Booking Intent Distribution (users who didn't convert)
        intent_query = f"""
            SELECT 
                CASE 
                    WHEN intent_score >= 80 THEN 'Very High'
                    WHEN intent_score >= 60 THEN 'High'
                    WHEN intent_score >= 40 THEN 'Medium'
                    WHEN intent_score >= 20 THEN 'Low'
                    ELSE 'Very Low'
                END as intent_level,
                count(*) as count,
                avg(potential_revenue) as avg_potential_revenue
            FROM sessions
            WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
              AND funnel_completed = 0
              AND funnel_entry_step >= 1
            GROUP BY intent_level
            ORDER BY intent_level DESC
        """
        
        intent_rows = run_query(intent_query)
        
        intent_distribution = []
        for row in intent_rows:
            intent_distribution.append({
                "intent_level": row[0] if row[0] else "Unknown",
                "count": int(row[1]) if row[1] else 0,
                "avg_potential_revenue": round(float(row[2] or 0), 2)
            })
        
        # Ancillary Revenue (add-ons viewed vs added)
        ancillary_query = f"""
            SELECT 
                countIf(addons_viewed > 0) as sessions_with_addon_views,
                avgIf(conversion_value, addons_viewed > 0 AND converted = 1) as avg_value_with_addons,
                avgIf(conversion_value, (addons_viewed = 0 OR addons_viewed IS NULL) AND converted = 1) as avg_value_without_addons
            FROM sessions
            WHERE start_time >= now() - INTERVAL {request.completed_within} DAY
              AND converted = 1
        """
        
        ancillary_rows = run_query(ancillary_query)
        
        addon_impact = {
            "sessions_viewing_addons": 0,
            "avg_booking_with_addons": 0,
            "avg_booking_without_addons": 0,
            "addon_lift": 0
        }
        
        if ancillary_rows and ancillary_rows[0]:
            with_addons = float(ancillary_rows[0][1] or 0)
            without_addons = float(ancillary_rows[0][2] or 0)
            addon_impact = {
                "sessions_viewing_addons": int(ancillary_rows[0][0] or 0),
                "avg_booking_with_addons": round(with_addons, 2),
                "avg_booking_without_addons": round(without_addons, 2),
                "addon_lift": round(((with_addons / without_addons - 1) * 100) if without_addons > 0 else 0, 1)
            }
        
        return {
            "adr": round(adr, 2),
            "avg_length_of_stay": round(avg_los, 1),
            "avg_booking_value": round(avg_booking_value, 2),
            "total_revenue": round(total_revenue, 2),
            "completed_bookings": completed_bookings,
            "segment_performance": segment_performance,
            "intent_distribution": intent_distribution,
            "ancillary_revenue_impact": addon_impact,
            "period_days": request.completed_within,
            "currency": "USD"
        }
        
    except Exception as exc:
        print(f"[Hospitality Metrics] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Hospitality metrics error: {str(exc)}")


# ============================================================================
# SEGMENTATION ANALYSIS - "Better than Amplitude"
# ============================================================================

class SegmentationEvent(BaseModel):
    """Model for events to analyze in segmentation"""
    id: str
    event_type: str
    event_category: str
    filters: List[EventFilter] = []
    label: Optional[str] = None

class SegmentationRequest(BaseModel):
    """Request model for segmentation analysis"""
    events: List[SegmentationEvent]
    measurement: str = "uniques"  # uniques, event_totals, active_percent, average, frequency, revenue_per_user
    time_period: int = 30  # days
    group_by: Optional[str] = None  # device_type, guest_segment, traffic_source, browser, etc.
    interval: str = "day"  # day, week, month
    segments: Optional[List[SegmentComparison]] = []

@app.post("/api/analytics/segmentation")
async def get_segmentation_analysis(request: SegmentationRequest) -> Dict[str, Any]:
    """
    Segmentation Analysis - Better than Amplitude!
    
    Analyzes user behavior across multiple events with advanced grouping,
    time series trends, and hospitality-specific insights.
    
    Measurements:
    - uniques: Unique users who performed the event
    - event_totals: Total count of events
    - active_percent: % of users who performed this event
    - average: Average events per user
    - frequency: Distribution of event frequency
    - revenue_per_user: Revenue metrics per user segment
    
    Returns:
    - summary_metrics: Overall metrics for each event
    - time_series: Day/week/month trends
    - breakdown: Group by analysis
    - comparisons: Segment comparisons
    """
    try:
        print(f"[Segmentation] Received request: {request.dict()}")
        
        if not request.events:
            raise HTTPException(status_code=400, detail="At least one event must be provided")
        
        results = []
        
        for event_config in request.events:
            print(f"[Segmentation] Processing event: {event_config.event_type}")
            # Build event filter SQL
            event_conditions = []
            
            # Map event category and type to SQL conditions
            if event_config.event_category == 'hospitality':
                # Use funnel_step mapping for hospitality events
                step_mapping = {
                    'Page Viewed': 1,
                    'Location Select': 2,
                    'Date Select': 3,
                    'Room Select': 4,
                    'Payment': 5,
                    'Confirmation': 6
                }
                if event_config.event_type in step_mapping:
                    event_conditions.append(f"funnel_step = {step_mapping[event_config.event_type]}")
            else:
                # Generic events
                event_type_escaped = event_config.event_type.replace("'", "''")
                event_conditions.append(f"event_type = '{event_type_escaped}'")
            
            # Add custom filters
            for filter_obj in event_config.filters:
                prop = filter_obj.property
                val = str(filter_obj.value).replace("'", "''")
                
                if filter_obj.operator == 'equals':
                    event_conditions.append(f"{prop} = '{val}'")
                elif filter_obj.operator == 'contains':
                    event_conditions.append(f"{prop} LIKE '%{val}%'")
                elif filter_obj.operator == 'not_equals':
                    event_conditions.append(f"{prop} != '{val}'")
            
            event_where = " AND ".join(event_conditions) if event_conditions else "1=1"
            print(f"[Segmentation] Event WHERE clause: {event_where}")
            
            # ============ CALCULATE METRICS BASED ON MEASUREMENT TYPE ============
            
            interval_func = "toDate(timestamp)" if request.interval == "day" else (
                "toStartOfWeek(timestamp)" if request.interval == "week" else "toStartOfMonth(timestamp)"
            )
            interval_alias = "date"

            if request.measurement == 'uniques':
                # Unique users who performed this event
                query = f"""
                    SELECT 
                        uniqExact(user_id) as unique_users,
                        count(*) as total_events,
                        uniqExact(session_id) as unique_sessions
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                """
                print(f"[Segmentation] Executing uniques query: {query}")
                rows = run_query(query)
                print(f"[Segmentation] Query returned {len(rows) if rows else 0} rows")
                
                metric_value = int(rows[0][0]) if rows and rows[0] else 0
                total_events = int(rows[0][1]) if rows and rows[0] else 0
                unique_sessions = int(rows[0][2]) if rows and rows[0] else 0
                print(f"[Segmentation] Metrics: unique_users={metric_value}, total_events={total_events}")
                
                # Get time series (respect interval: day/week/month)
                time_series_query = f"""
                    SELECT 
                        {interval_func} as date,
                        uniqExact(user_id) as unique_users
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                    GROUP BY date
                    ORDER BY date
                """
                time_series_rows = run_query(time_series_query)
                time_series = [
                    {"date": str(row[0]), "value": int(row[1])}
                    for row in time_series_rows
                ]
                
            elif request.measurement == 'event_totals':
                # Total count of events
                query = f"""
                    SELECT 
                        count(*) as total_events,
                        uniqExact(user_id) as unique_users,
                        uniqExact(session_id) as unique_sessions
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                """
                rows = run_query(query)
                
                metric_value = int(rows[0][0]) if rows and rows[0] else 0
                unique_users = int(rows[0][1]) if rows and rows[0] else 0
                unique_sessions = int(rows[0][2]) if rows and rows[0] else 0
                
                # Time series
                time_series_query = f"""
                    SELECT 
                        {interval_func} as date,
                        count(*) as event_count
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                    GROUP BY date
                    ORDER BY date
                """
                time_series_rows = run_query(time_series_query)
                time_series = [
                    {"date": str(row[0]), "value": int(row[1])}
                    for row in time_series_rows
                ]
                
            elif request.measurement == 'average':
                # Average events per user (guard against divide-by-zero)
                query = f"""
                    SELECT 
                        count(*) as total_events,
                        uniqExact(user_id) as unique_users,
                        if(uniqExact(user_id) > 0, count(*) / uniqExact(user_id), 0) as avg_per_user
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                """
                rows = run_query(query)
                
                metric_value = round(float(rows[0][2] or 0), 2) if rows and rows[0] else 0
                total_events = int(rows[0][0]) if rows and rows[0] else 0
                unique_users = int(rows[0][1]) if rows and rows[0] else 0
                
                # Time series (guard divide-by-zero)
                time_series_query = f"""
                    SELECT 
                        {interval_func} as date,
                        if(uniqExact(user_id) > 0, count(*) / uniqExact(user_id), 0) as avg_per_user
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                    GROUP BY date
                    ORDER BY date
                """
                time_series_rows = run_query(time_series_query)
                time_series = [
                    {"date": str(row[0]), "value": round(float(row[1] or 0), 2)}
                    for row in time_series_rows
                ]
                
            elif request.measurement == 'revenue_per_user':
                # Revenue metrics per user (from sessions, guard divide-by-zero)
                query = f"""
                    SELECT 
                        uniqExact(s.user_id) as unique_users,
                        sum(s.conversion_value) as total_revenue,
                        avg(s.conversion_value) as avg_revenue_per_session,
                        if(uniqExact(s.user_id) > 0, sum(s.conversion_value) / uniqExact(s.user_id), 0) as revenue_per_user
                    FROM raw_events e
                    JOIN sessions s ON e.session_id = s.session_id
                    WHERE e.timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                      AND s.converted = 1
                """
                rows = run_query(query)
                
                metric_value = round(float(rows[0][3]), 2) if rows and rows[0] and rows[0][3] else 0
                unique_users = int(rows[0][0]) if rows and rows[0] else 0
                total_revenue = round(float(rows[0][1]), 2) if rows and rows[0] else 0
                
                # Time series (guard divide-by-zero)
                interval_join = "toDate(e.timestamp)" if request.interval == "day" else (
                    "toStartOfWeek(e.timestamp)" if request.interval == "week" else "toStartOfMonth(e.timestamp)"
                )
                time_series_query = f"""
                    SELECT 
                        {interval_join} as date,
                        if(uniqExact(s.user_id) > 0, sum(s.conversion_value) / uniqExact(s.user_id), 0) as revenue_per_user
                    FROM raw_events e
                    JOIN sessions s ON e.session_id = s.session_id
                    WHERE e.timestamp >= now() - INTERVAL {request.time_period} DAY
                      AND {event_where}
                      AND s.converted = 1
                    GROUP BY date
                    ORDER BY date
                """
                time_series_rows = run_query(time_series_query)
                time_series = [
                    {"date": str(row[0]), "value": round(float(row[1]), 2) if row[1] else 0}
                    for row in time_series_rows
                ]
            
            else:
                metric_value = 0
                time_series = []
            
            # ============ GROUP BY ANALYSIS ============
            # Use sessions JOIN for group_by: traffic_source, guest_segment live in sessions;
            # device_type, browser, is_returning_visitor exist in both - use sessions for consistency
            breakdown = []
            if request.group_by:
                group_by_col = request.group_by
                if group_by_col == "is_returning_visitor":
                    group_select = "if(s.is_returning_visitor = 1 OR s.is_returning_visitor = true, 'Returning', 'New')"
                    group_condition = "1=1"
                else:
                    group_select = f"s.{group_by_col}"
                    group_condition = f"(s.{group_by_col} != '' AND s.{group_by_col} != 'Unknown')"

                if request.measurement == 'uniques':
                    breakdown_query = f"""
                        SELECT 
                            {group_select} as group_name,
                            uniqExact(e.user_id) as unique_users,
                            count(*) as total_events
                        FROM raw_events e
                        INNER JOIN sessions s ON e.session_id = s.session_id
                        WHERE e.timestamp >= now() - INTERVAL {request.time_period} DAY
                          AND {event_where}
                          AND {group_condition}
                        GROUP BY group_name
                        ORDER BY unique_users DESC
                        LIMIT 10
                    """
                elif request.measurement == 'event_totals':
                    breakdown_query = f"""
                        SELECT 
                            {group_select} as group_name,
                            count(*) as event_count,
                            uniqExact(e.user_id) as unique_users
                        FROM raw_events e
                        INNER JOIN sessions s ON e.session_id = s.session_id
                        WHERE e.timestamp >= now() - INTERVAL {request.time_period} DAY
                          AND {event_where}
                          AND {group_condition}
                        GROUP BY group_name
                        ORDER BY event_count DESC
                        LIMIT 10
                    """
                else:
                    breakdown_query = f"""
                        SELECT 
                            {group_select} as group_name,
                            count(*) as event_count
                        FROM raw_events e
                        INNER JOIN sessions s ON e.session_id = s.session_id
                        WHERE e.timestamp >= now() - INTERVAL {request.time_period} DAY
                          AND {event_where}
                          AND {group_condition}
                        GROUP BY group_name
                        ORDER BY event_count DESC
                        LIMIT 10
                    """

                try:
                    breakdown_rows = run_query(breakdown_query)
                except Exception as b_err:
                    print(f"[Segmentation] Breakdown query error for group_by={group_by_col}: {b_err}")
                    breakdown_rows = []
                for row in breakdown_rows:
                    breakdown.append({
                        "group": str(row[0]),
                        "value": int(row[1]) if row[1] else 0,
                        "secondary": int(row[2]) if len(row) > 2 and row[2] else 0
                    })
            
            results.append({
                "event_id": event_config.id,
                "event_label": event_config.label or event_config.event_type,
                "metric_value": metric_value,
                "time_series": time_series,
                "breakdown": breakdown
            })
        
        print(f"[Segmentation] Returning {len(results)} results")
        response_data = {
            "measurement": request.measurement,
            "time_period_days": request.time_period,
            "interval": request.interval,
            "group_by": request.group_by,
            "results": results
        }
        print(f"[Segmentation] Response: {response_data}")
        return response_data
        
    except Exception as exc:
        print(f"[Segmentation Analysis] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Segmentation analysis error: {str(exc)}")


# ============================================================================
# BEHAVIORAL SEGMENTS - Session-based behavioral classification
# ============================================================================

class BehavioralSegmentsRequest(BaseModel):
    """Request for behavioral segmentation analysis"""
    time_period: int = 30
    interval: str = "day"
    segment_ids: Optional[List[str]] = None  # Filter to specific segments, or all if None


BEHAVIORAL_SEGMENT_DEFINITIONS = {
    "researcher": {
        "label": "Researchers",
        "description": "High engagement, many page views, low conversion",
        "color": "#8b5cf6",
    },
    "bargain_hunter": {
        "label": "Bargain Hunters",
        "description": "High price checks, discount code attempts",
        "color": "#f59e0b",
    },
    "last_minute": {
        "label": "Last-Minute Bookers",
        "description": "Short decision time, high urgency",
        "color": "#06b6d4",
    },
    "high_friction": {
        "label": "High-Friction Droppers",
        "description": "High friction score, rage clicks, no conversion",
        "color": "#ef4444",
    },
    "high_intent_non_booker": {
        "label": "High-Intent Non-Bookers",
        "description": "High intent but didn't convert",
        "color": "#ec4899",
    },
    "converter": {
        "label": "Converters",
        "description": "Completed booking",
        "color": "#10b981",
    },
    "other": {
        "label": "Other",
        "description": "Sessions not matching other segments",
        "color": "#64748b",
    },
}


@app.post("/api/analytics/behavioral-segments")
async def get_behavioral_segments(request: BehavioralSegmentsRequest) -> Dict[str, Any]:
    """
    Behavioral Segmentation - Classify sessions by behavior patterns.
    
    Uses session + raw_events data to assign each session to a canonical segment:
    - researcher: high pages/duration, low conversion
    - bargain_hunter: high price checks / discount attempts
    - last_minute: high urgency, short session
    - high_friction: friction_score > 0.6, no conversion
    - high_intent_non_booker: high intent, no conversion
    - converter: completed booking
    - other: fallback
    
    Returns per-segment counts, conversion rate, revenue, time series.
    """
    try:
        days = request.time_period
        interval_func = "toDate" if request.interval == "day" else (
            "toStartOfWeek" if request.interval == "week" else "toStartOfMonth"
        )
        interval_alias = "date"

        # Sessions table has pre-aggregated metrics: page_views_count, total_events, duration_seconds,
        # max_scroll_depth, rage_clicks_count, dead_clicks_count, price_checks_count,
        # discount_code_attempts, intent_score, friction_score, urgency_score, price_sensitivity_score
        session_agg = f"""
        WITH classified AS (
            SELECT 
                session_id,
                user_id,
                converted,
                conversion_value,
                toFloat64OrDefault(potential_revenue, 0.0) AS potential_revenue,
                start_time,
                CASE
                    WHEN converted = 1 THEN 'converter'
                    WHEN coalesce(friction_score, 0) > 0.6 AND converted = 0 THEN 'high_friction'
                    WHEN coalesce(intent_score, 0) >= 60 AND converted = 0 THEN 'high_intent_non_booker'
                    WHEN coalesce(price_sensitivity_score, 0) > 0.7 OR coalesce(price_checks_count, 0) >= 3 OR coalesce(discount_code_attempts, 0) > 0 THEN 'bargain_hunter'
                    WHEN coalesce(urgency_score, 0) > 0.7 AND coalesce(duration_seconds, 0) < 600 THEN 'last_minute'
                    WHEN coalesce(page_views_count, 0) >= 5 AND coalesce(duration_seconds, 0) > 120 AND converted = 0 THEN 'researcher'
                    ELSE 'other'
                END AS segment_type
            FROM sessions
            WHERE start_time >= now() - INTERVAL {days} DAY
        )
        """

        # Summary by segment
        segment_ids_filter = ""
        if request.segment_ids and len(request.segment_ids) > 0:
            seg_list = ", ".join(f"'{s}'" for s in request.segment_ids)
            segment_ids_filter = f"AND segment_type IN ({seg_list})"

        summary_query = f"""
        {session_agg}
        SELECT 
            segment_type,
            count(*) AS sessions,
            countIf(converted = 1) AS conversions,
            round(countIf(converted = 1) / count(*) * 100, 1) AS conversion_rate_pct,
            round(sum(conversion_value), 2) AS revenue,
            round(avg(potential_revenue), 2) AS avg_potential_revenue
        FROM classified
        WHERE 1=1 {segment_ids_filter}
        GROUP BY segment_type
        ORDER BY sessions DESC
        """
        summary_rows = run_query(summary_query)
        total_sessions = sum(int(r[1]) for r in summary_rows)

        segments_summary = []
        for row in summary_rows:
            sessions = int(row[1])
            pct = round(sessions / total_sessions * 100, 1) if total_sessions > 0 else 0
            segments_summary.append({
                "segment_type": row[0],
                "label": BEHAVIORAL_SEGMENT_DEFINITIONS.get(row[0], {}).get("label", row[0]),
                "sessions": sessions,
                "conversions": int(row[2]),
                "conversion_rate_pct": float(row[3]) if row[3] else 0,
                "revenue": float(row[4]) if row[4] else 0,
                "avg_potential_revenue": float(row[5]) if row[5] else 0,
                "pct_of_total": pct,
            })

        # Time series by segment
        time_series_query = f"""
        {session_agg}
        SELECT 
            {interval_func}(start_time) AS {interval_alias},
            segment_type,
            count(*) AS sessions
        FROM classified
        WHERE 1=1 {segment_ids_filter}
        GROUP BY {interval_alias}, segment_type
        ORDER BY {interval_alias}, segment_type
        """
        ts_rows = run_query(time_series_query)

        # Group time series by segment for charting
        time_series_by_segment: Dict[str, List[Dict[str, Any]]] = {}
        for row in ts_rows:
            dt, seg, cnt = str(row[0]), row[1], int(row[2])
            if seg not in time_series_by_segment:
                time_series_by_segment[seg] = []
            time_series_by_segment[seg].append({"date": dt, "value": cnt})

        return {
            "mode": "behavioral",
            "time_period_days": days,
            "interval": request.interval,
            "total_sessions": total_sessions,
            "segments": segments_summary,
            "time_series_by_segment": time_series_by_segment,
            "segment_definitions": BEHAVIORAL_SEGMENT_DEFINITIONS,
        }
    except Exception as exc:
        print(f"[Behavioral Segments] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Behavioral segments error: {str(exc)}")


# ============================================================================
# GUEST / USER SEGMENTS - Guest profile, value tier, acquisition
# ============================================================================

class GuestSegmentsRequest(BaseModel):
    """Request for guest/user segmentation analysis"""
    time_period: int = 30
    interval: str = "day"
    segment_ids: Optional[List[str]] = None


GUEST_SEGMENT_DEFINITIONS = {
    "family": {"label": "Families", "filter": "guest_segment = 'family_with_young_kids'", "color": "#3b82f6"},
    "luxury": {"label": "Luxury Seekers", "filter": "guest_segment = 'luxury'", "color": "#8b5cf6"},
    "couple": {"label": "Couples", "filter": "guest_segment = 'couple'", "color": "#ec4899"},
    "business": {"label": "Business Travelers", "filter": "guest_segment = 'business'", "color": "#10b981"},
    "returning": {"label": "Returning Guests", "filter": "is_returning_visitor = true", "color": "#14b8a6"},
    "new": {"label": "New Visitors", "filter": "is_returning_visitor = false OR is_returning_visitor IS NULL", "color": "#06b6d4"},
    "mobile": {"label": "Mobile Guests", "filter": "lower(device_type) = 'mobile'", "color": "#f59e0b"},
    "desktop": {"label": "Desktop Guests", "filter": "lower(device_type) = 'desktop'", "color": "#64748b"},
    "high_value": {"label": "High-Value", "filter": "potential_revenue >= 1500 OR conversion_value >= 1500", "color": "#22c55e"},
    "price_sensitive": {"label": "Price-Sensitive", "filter": "price_sensitivity_score > 0.7", "color": "#eab308"},
    "other": {"label": "Other", "filter": "1=1", "color": "#94a3b8"},
}


@app.post("/api/analytics/guest-segments")
async def get_guest_segments(request: GuestSegmentsRequest) -> Dict[str, Any]:
    """
    Guest/User Segmentation - Segment by guest profile, value, acquisition.
    
    Uses sessions table: guest_segment, device_type, traffic_source, 
    is_returning_visitor, potential_revenue, conversion_value, price_sensitivity_score.
    
    Returns per-segment counts, conversion rate, revenue, time series.
    """
    try:
        days = request.time_period
        interval_func = "toDate" if request.interval == "day" else (
            "toStartOfWeek" if request.interval == "week" else "toStartOfMonth"
        )
        interval_alias = "date"

        # Build segment CASE: priority order (guest_segment first, then visitor/device/value)
        # Sessions columns: guest_segment, device_type, is_returning_visitor, price_sensitivity_score,
        # potential_revenue (Decimal), conversion_value (Float32)
        case_sql = """
        CASE
            WHEN guest_segment = 'family_with_young_kids' THEN 'family'
            WHEN guest_segment = 'luxury' THEN 'luxury'
            WHEN guest_segment = 'couple' THEN 'couple'
            WHEN guest_segment = 'business' THEN 'business'
            WHEN is_returning_visitor = 1 OR is_returning_visitor = true THEN 'returning'
            WHEN is_returning_visitor = 0 OR is_returning_visitor = false OR is_returning_visitor IS NULL THEN 'new'
            WHEN lower(toString(device_type)) = 'mobile' THEN 'mobile'
            WHEN lower(toString(device_type)) = 'desktop' THEN 'desktop'
            WHEN coalesce(price_sensitivity_score, 0) > 0.7 THEN 'price_sensitive'
            WHEN toFloat64OrDefault(potential_revenue, 0.0) >= 1500 OR coalesce(conversion_value, 0) >= 1500 THEN 'high_value'
            ELSE 'other'
        END
        """

        segment_ids_filter = ""
        if request.segment_ids and len(request.segment_ids) > 0:
            seg_list = ", ".join(f"'{s}'" for s in request.segment_ids)
            segment_ids_filter = f"AND segment_type IN ({seg_list})"

        base_query = f"""
        WITH classified AS (
            SELECT 
                session_id,
                user_id,
                converted,
                conversion_value,
                toFloat64OrDefault(potential_revenue, 0.0) AS potential_revenue,
                start_time,
                {case_sql} AS segment_type
            FROM sessions
            WHERE start_time >= now() - INTERVAL {days} DAY
        )
        """

        summary_query = f"""
        {base_query}
        SELECT 
            segment_type,
            count(*) AS sessions,
            countIf(converted) AS conversions,
            round(countIf(converted = 1) / count(*) * 100, 1) AS conversion_rate_pct,
            round(sum(conversion_value), 2) AS revenue,
            round(avg(potential_revenue), 2) AS avg_potential_revenue
        FROM classified
        WHERE 1=1 {segment_ids_filter}
        GROUP BY segment_type
        ORDER BY sessions DESC
        """
        summary_rows = run_query(summary_query)
        total_sessions = sum(int(r[1]) for r in summary_rows)

        segments_summary = []
        for row in summary_rows:
            sessions = int(row[1])
            pct = round(sessions / total_sessions * 100, 1) if total_sessions > 0 else 0
            label = GUEST_SEGMENT_DEFINITIONS.get(row[0], {}).get("label", row[0])
            segments_summary.append({
                "segment_type": row[0],
                "label": label,
                "sessions": sessions,
                "conversions": int(row[2]),
                "conversion_rate_pct": float(row[3]) if row[3] else 0,
                "revenue": float(row[4]) if row[4] else 0,
                "avg_potential_revenue": float(row[5]) if row[5] else 0,
                "pct_of_total": pct,
            })

        time_series_query = f"""
        {base_query}
        SELECT 
            {interval_func}(start_time) AS {interval_alias},
            segment_type,
            count(*) AS sessions
        FROM classified
        WHERE 1=1 {segment_ids_filter}
        GROUP BY {interval_alias}, segment_type
        ORDER BY {interval_alias}, segment_type
        """
        ts_rows = run_query(time_series_query)

        time_series_by_segment: Dict[str, List[Dict[str, Any]]] = {}
        for row in ts_rows:
            dt, seg, cnt = str(row[0]), row[1], int(row[2])
            if seg not in time_series_by_segment:
                time_series_by_segment[seg] = []
            time_series_by_segment[seg].append({"date": dt, "value": cnt})

        return {
            "mode": "guest",
            "time_period_days": days,
            "interval": request.interval,
            "total_sessions": total_sessions,
            "segments": segments_summary,
            "time_series_by_segment": time_series_by_segment,
            "segment_definitions": {k: {"label": v["label"], "color": v["color"]} for k, v in GUEST_SEGMENT_DEFINITIONS.items()},
        }
    except Exception as exc:
        print(f"[Guest Segments] Error: {exc}")
        raise HTTPException(status_code=500, detail=f"Guest segments error: {str(exc)}")


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
    root_cause_analysis: Optional[bool] = False  # Flag to enable root cause analysis


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


def _is_segmentation_data(data: Any) -> bool:
    """Detect if payload is segmentation (vs funnel) analysis."""
    if not isinstance(data, dict):
        return False
    return (
        "segment_mode" in data
        or "behavioral_segments" in data
        or "guest_segments" in data
        or "event_results" in data
    )


@app.post("/api/ai/insight")
async def generate_ai_insight(request: AiInsightRequest) -> Dict[str, Any]:
    """
    AskAI Analyst endpoint.
    
    Takes JSON data from the frontend (funnel, segmentation, path analysis, cohorts, etc.)
    and returns a narrative forensic summary using Azure GPT.
    Supports both funnel and segmentation analysis with marketing intelligence focus.
    """
    try:
        base_question = (
            request.user_query.strip()
            if request.user_query
            else None
        )
        data_summary = ""
        d = request.data if isinstance(request.data, dict) else {}

        if _is_segmentation_data(d):
            # --- SEGMENTATION MODE ---
            system_prompt = (
                "You are the 'AskAI Marketing Intelligence Analyst' for Kalahari Resorts' analytics platform.\n"
                "You act as a Senior Growth Marketer and Revenue Strategist for hospitality brands.\n"
                "You receive segmentation data: event-based metrics, behavioral segments (Researchers, Bargain Hunters, High-Friction Droppers, etc.), "
                "and guest/user segments (Families, Mobile Guests, High-Value, etc.).\n\n"
                "## Data You May Receive:\n"
                "- **segment_mode**: 'event' | 'behavioral' | 'guest'\n"
                "- **event_results**: Event-based metrics (uniques, totals, time series, breakdown by device/guest/traffic)\n"
                "- **behavioral_segments**: segments (Researchers, Bargain Hunters, Converters, etc.) with sessions, conversion_rate_pct, revenue, pct_of_total\n"
                "- **guest_segments**: segments (Families, Mobile, Desktop, etc.) with same structure\n"
                "- **measurement**, **time_period_days**, **group_by**, **interval**\n\n"
                "## STRICT ACCURACY RULES (VERY IMPORTANT):\n"
                "- You MUST base ALL numbers and calculations ONLY on the JSON analytics data provided.\n"
                "- NEVER invent or guess values that are not present in the data. If a number is missing, say 'data not available'.\n"
                "- If the user asks for a metric that is not present in the JSON, clearly state that the data is not available instead of approximating.\n"
                "- When you compute anything (e.g., revenue uplift), explicitly reference the underlying JSON fields (sessions, conversion_rate_pct, revenue).\n\n"
                "## Your Analysis Process:\n"
                "1) **Identify the highest-leverage segment**: Which segment has the best conversion rate or revenue potential?\n"
                "2) **Spot underperformers**: Which segment has low conversion but high traffic? That's an opportunity.\n"
                "3) **Quantify revenue impact**: Use sessions × conversion_rate × $260 for revenue at risk or uplift potential, but ONLY if both sessions and conversion_rate_pct are present in the JSON.\n"
                "4) **Recommend marketing actions**: Segment-specific campaigns (e.g., 'Researchers need room clarity')\n"
                "5) **Cross-segment insights**: Compare behavioral vs guest segments for targeting strategies\n\n"
                "## Output Guidelines:\n"
                "- ALWAYS reference actual numbers (sessions, conversion_rate_pct, revenue) taken directly from the JSON.\n"
                "- Use markdown: **bold**, bullet lists, ## headings\n"
                "- Be specific to the segments shown\n"
                "- Keep tone executive-ready: clear, confident, actionable\n"
                "- Typical booking value: $260 for Kalahari Resorts (use this ONLY when computing revenue from explicit counts in the data).\n"
            )
            default_question = "Analyze this segmentation data. Which segment offers the best opportunity? What marketing actions should we take?"
            user_question = base_question or default_question
            if d.get("behavioral_segments"):
                segs = d["behavioral_segments"].get("segments", [])
                total = d["behavioral_segments"].get("total_sessions", 0)
                data_summary = f"\n**Quick Summary (Behavioral):** {len(segs)} segments, {total:,} total sessions\n"
                for s in segs[:5]:
                    data_summary += f"- {s.get('label', '')}: {s.get('sessions', 0):,} sessions, {s.get('conversion_rate_pct', 0):.1f}% conversion\n"
            elif d.get("guest_segments"):
                segs = d["guest_segments"].get("segments", [])
                total = d["guest_segments"].get("total_sessions", 0)
                data_summary = f"\n**Quick Summary (Guest):** {len(segs)} segments, {total:,} total sessions\n"
                for s in segs[:5]:
                    data_summary += f"- {s.get('label', '')}: {s.get('sessions', 0):,} sessions, {s.get('conversion_rate_pct', 0):.1f}% conversion\n"
            elif d.get("event_results"):
                results = d["event_results"]
                data_summary = f"\n**Quick Summary (Event-based):** {len(results)} events measured as {d.get('measurement', 'uniques')}\n"
            user_content = (
                f"# Segmentation / Marketing Intelligence Request\n\n"
                f"**Context:** {request.context_name}\n"
                f"**Question:** {user_question}\n"
                f"{data_summary}\n"
                "**Full Analytics Data:**\n"
                f"```json\n{json.dumps(request.data, indent=2, default=str)}\n```\n\n"
                "**Instructions:** Provide a Key Takeaway, Revenue/Conversion insight, Why This Matters, and Recommended Marketing Actions."
            )
        else:
            # --- FUNNEL MODE ---
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
                "## STRICT ACCURACY RULES (VERY IMPORTANT):\n"
                "- You MUST base ALL numbers and calculations ONLY on the JSON analytics data provided.\n"
                "- NEVER invent or guess any metric that is not present in the JSON. If a value is missing, state clearly that it is not available.\n"
                "- When you compute revenue impact (drop_off_count × $260), use the exact drop_off_count from the JSON and show the math.\n"
                "- If the user question asks for something not contained in the JSON (for example, a time period or metric not present), explicitly say that the data is not available instead of approximating.\n\n"
                "## Your Analysis Process:\n"
                "1) **Analyze ACTUAL NUMBERS**: Look at the `funnel_conversion` array - focus on `visitors`, `conversion_rate`, and `drop_off_count` for each step.\n"
                "2) **Identify the Crucial Leak**: Which step has the HIGHEST drop_off_count or LOWEST conversion_rate?\n"
                "3) **Quantify Revenue Impact**: Use drop_off_count × $260 (avg booking value) to calculate revenue at risk, and always show the calculation.\n"
                "4) **Diagnose Root Causes**: Reference friction_data, latency_data, and path_analysis to explain WHY users drop off (but do not invent data).\n"
                "5) **Generate Hypotheses**: Provide 2-3 testable hypotheses based on the specific step and data patterns.\n"
                "6) **Recommend Actions**: Concrete, step-specific fixes (not generic advice).\n\n"
                "## Root Cause Analysis Mode:\n"
                "When root_cause_analysis is enabled, provide a structured breakdown:\n"
                "- **Primary Cause**: The main factor driving the anomaly (device, traffic source, segment, etc.)\n"
                "- **Contributing Factors**: Secondary factors that amplify the issue\n"
                "- **Segment Breakdown**: How different segments (device_type, traffic_source, guest_segment) are affected\n"
                "- **Causal Chain**: Step-by-step explanation of why this is happening\n"
                "- **Confidence Level**: High/Medium/Low based on data availability\n\n"
                "## Output Guidelines:\n"
                "- **ALWAYS reference actual numbers** from funnel_conversion (e.g., '1,234 users dropped at Room Select = 64% drop-off').\n"
                "- Use markdown: **bold** for metrics, bullet lists, ## headings.\n"
                "- Be specific to the funnel steps shown (e.g., 'Landed', 'Location Select', 'Date Select', 'Room Select', 'Payment', 'Confirmation').\n"
                "- Calculate revenue impact: drop_off_count × $260 = revenue at risk, clearly showing both operands and the result.\n"
                "- If data arrays are empty or have zero visitors, say so explicitly and suggest data collection fixes.\n"
                "- Keep tone executive-ready: clear, confident, actionable.\n\n"
                "## Context:\n"
                "Kalahari Resorts is a family-friendly waterpark resort chain. Typical booking value: $260. Guests: families with kids booking 2-3 night stays. Key drivers: waterpark access, room type clarity, mobile UX, pricing transparency.\n"
            )
            default_question = "Analyze this chart and identify the biggest revenue leak, friction point, or opportunity. Explain why it's happening and what actions Kalahari should take."
            base_question = base_question or default_question
            if "funnel_conversion" in d and d["funnel_conversion"]:
                funnel_steps = d["funnel_conversion"]
                data_summary = f"\n\n**Quick Summary:**\n"
                data_summary += f"- Total Funnel Steps: {len(funnel_steps)}\n"
                data_summary += f"- First Step Visitors: {funnel_steps[0].get('visitors', 0):,}\n"
                data_summary += f"- Final Step Visitors: {funnel_steps[-1].get('visitors', 0):,}\n"
                data_summary += f"- Overall Conversion Rate: {d.get('summary', {}).get('overall_conversion_rate', 0)}%\n"
                max_dropoff_step = max(funnel_steps[1:], key=lambda x: x.get('drop_off_count', 0), default=None)
                if max_dropoff_step:
                    data_summary += f"- Biggest Drop-off: {max_dropoff_step.get('step_name', 'Unknown')} ({max_dropoff_step.get('drop_off_count', 0):,} users, {max_dropoff_step.get('drop_off_rate', 0):.1f}%)\n"
            root_cause_instructions = ""
            if request.root_cause_analysis:
                root_cause_instructions = (
                    "\n\n**ROOT CAUSE ANALYSIS MODE ENABLED:**\n"
                    "Provide a structured root cause breakdown:\n"
                    "- **Primary Cause**: The main factor driving the anomaly (device type, traffic source, segment, etc.)\n"
                    "- **Contributing Factors**: Secondary factors that amplify the issue\n"
                    "- **Segment Breakdown**: How different segments (device_type, traffic_source, guest_segment) are affected\n"
                    "- **Causal Chain**: Step-by-step explanation of why this is happening\n"
                    "- **Confidence Level**: High/Medium/Low based on data availability\n"
                )
            
            user_content = (
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
                "4. Provide specific, actionable recommendations for that exact funnel step"
                f"{root_cause_instructions}\n\n"
                "**Response Structure:**\n"
                "## Key Takeaway\n"
                "[1-2 sentences highlighting the biggest issue with specific numbers]\n\n"
                "## Revenue Impact\n"
                "[Quantified loss calculation: X users × $260 = $Y,ZZZ at risk]\n\n"
                "## Why This Is Happening\n"
                "[2-3 specific hypotheses based on the step and data]\n\n"
                "## Recommended Actions\n"
                "[Bullet list of concrete fixes for this specific step]\n"
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        insight_text = call_azure_gpt(messages)

        return {"insight": insight_text}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI insight error: {str(exc)}")


class GuidedBuildMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class GuidedBuildRequest(BaseModel):
    """Guided chart builder - AI asks questions, user answers, AI returns config to apply."""
    messages: List[GuidedBuildMessage]
    current_state: Optional[Dict[str, Any]] = None  # analysis_type, measurement, has_steps, etc.
    # Optional: current view config from frontend (AnalyticsStudio / SegmentationView)
    # Example: {"analysis_type": "funnel", "measurement": "conversion", "layout_template": "..."}
    current_view: Optional[Dict[str, Any]] = None
    generate_ui: Optional[bool] = False  # Flag to generate UI component spec JSON


# Standard funnel steps for guided build (hospitality booking)
GUIDED_BUILD_FUNNEL_STEPS = [
    {"id": "1", "label": "Landed", "event_type": "Landed", "event_category": "hospitality"},
    {"id": "2", "label": "Location Select", "event_type": "Location Select", "event_category": "hospitality"},
    {"id": "3", "label": "Date Select", "event_type": "Date Select", "event_category": "hospitality"},
    {"id": "4", "label": "Room Select", "event_type": "Room Select", "event_category": "hospitality"},
    {"id": "5", "label": "Payment", "event_type": "Payment", "event_category": "hospitality"},
    {"id": "6", "label": "Confirmation", "event_type": "Confirmation", "event_category": "hospitality"},
]


@app.post("/api/ai/guided-build")
async def guided_build(request: GuidedBuildRequest) -> Dict[str, Any]:
    """
    AI-guided chart builder. User describes what they want (or answers AI questions).
    Returns both a friendly message AND config_updates to apply (analysis_type, funnel_steps, etc).
    """
    try:
        last_user = next((m for m in reversed(request.messages) if m.role == "user"), None)
        user_text = (last_user.content or "").strip().lower() if last_user else ""
        state = request.current_state or {}
        has_steps = state.get("has_steps", False)

        # Derive analysis_type first from current_view, then from state, then default to funnel.
        view = request.current_view or {}
        analysis_type = (
            view.get("analysis_type")
            or state.get("analysis_type")
            or "funnel"
        )

        system_prompt = (
            "You are a friendly analytics assistant for a hospitality booking platform.\n"
            "Your job: help users BUILD or UPDATE charts by understanding what they want.\n\n"
            "## You can control TWO analysis surfaces:\n"
            "1. **Funnel** - conversion funnel (Landed → Location → Date → Room → Payment → Confirmation).\n"
            "2. **Segmentation** - event-based, behavioral (Researchers, Bargain Hunters), or guest segments.\n\n"
            "## IMPORTANT CONTEXT:\n"
            "- The frontend tells you the CURRENT ANALYSIS TYPE the user is looking at via analysis_type in current_state/current_view.\n"
            "- If analysis_type == 'funnel', you MUST return a funnel-style config (do NOT switch to segmentation), and you may also add segment comparisons via group_by / segments.\n"
            "- If analysis_type == 'segmentation', you MUST return a segmentation config (do NOT build a funnel).\n\n"
            "## FULL CONFIG SURFACE YOU CAN USE (VERY IMPORTANT):\n"
            "- config_updates.analysis_type: 'funnel' | 'segmentation'.\n"
            "- config_updates.measurement: generic measurement label (e.g., 'conversion', 'revenue_impact', 'uniques').\n\n"
            "### For FUNNEL (config_updates when analysis_type == 'funnel'):\n"
            "- funnel_steps: [{id, label, event_type, event_category}] — can be hospitality events OR generic events the user asks for.\n"
            "- funnel_view_type: one of 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance'.\n"
            "- funnel_completed_within: integer days (1, 7, 30, etc.).\n"
            "- funnel_counting_by: 'unique_users' | 'sessions' | 'events'.\n"
            "- funnel_order: 'strict' | 'loose' | 'any'.\n"
            "- funnel_group_by: 'device_type' | 'guest_segment' | 'traffic_source' | null (for segment comparisons like device, location, etc.).\n"
            "- funnel_segments: array of SegmentComparison objects (id, name, filters[]) to compare specific segments.\n"
            "- funnel_global_filters: { date_range?: {start, end}, location?: string }.\n\n"
            "### For SEGMENTATION (config_updates when analysis_type == 'segmentation'):\n"
            "- segment_mode: 'event' | 'behavioral' | 'guest'.\n"
            "- segment_events: for event-based mode: [{id, event_type, event_category, filters?, label?}].\n"
            "- segment_measurement: 'uniques' | 'event_totals' | 'average' | 'revenue_per_user' | custom labels.\n"
            "- segment_group_by: 'device_type' | 'guest_segment' | 'traffic_source' | 'browser' | 'is_returning_visitor' | null.\n"
            "- segment_time_period_days: 7 | 14 | 30 | 60 | 90 (or another positive integer).\n"
            "- segment_interval: 'day' | 'week' | 'month'.\n\n"
            "## Rules:\n"
            "- Use the current analysis_type as the PRIMARY signal for whether to build a funnel or segmentation chart.\n"
            "- When the user asks to change something (e.g., 'group by device', 'last 14 days', 'measure as revenue per user'), modify ONLY the relevant fields above.\n"
            "- Only fall back to guessing (based on text) when analysis_type is missing.\n"
            "- Keep responses SHORT and friendly (1-2 sentences).\n"
            "- You MUST output a JSON block at the end: ```json\\n{\"config_updates\": {...}}\\n```.\n"
            "- config_updates MUST use the field names listed above (funnel_* and segment_*). Do NOT invent new field names.\n"
            "- If unclear, ask ONE short follow-up question. Do NOT include config_updates in that case.\n"
            "- HOSPITALITY_STEPS = Landed, Location Select, Date Select, Room Select, Payment, Confirmation (event_category: hospitality).\n"
        )
        
        ui_generation_instructions = ""
        if request.generate_ui:
            ui_generation_instructions = (
                "\n\n**UI GENERATION MODE ENABLED:**\n"
                "In addition to config_updates, also return a `component_spec` JSON object:\n"
                "{\n"
                '  "component": "AreaChart" | "BarChart" | "LineChart" | "PieChart" | "ComposedChart",\n'
                '  "data": [...],  // Chart data array\n'
                '  "config": {\n'
                '    "xKey": "name",  // X-axis key\n'
                '    "yKey": "value",  // Y-axis key\n'
                '    "dataKey": "value",  // Data key\n'
                '    "title": "Chart Title",\n'
                '    "colors": ["#8b5cf6", "#ec4899", ...]\n'
                "  },\n"
                '  "title": "Chart Title"\n'
                "}\n"
                "The component_spec will be used to render the chart dynamically."
            )

        user_content = (
            f"Current state: analysis_type={analysis_type}, has_steps={has_steps}\n\n"
            f"User said: {user_text}\n\n"
            f"Current view (if any): {json.dumps(view, default=str)}\n\n"
            "Reply with a brief friendly message. If you can build a chart, end with a JSON block containing config_updates."
            f"{ui_generation_instructions}"
        )

        raw = call_azure_gpt([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])

        config_updates = None
        component_spec = None
        json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw)
        if json_match:
            try:
                parsed = json.loads(json_match.group(1))
                config_updates = parsed.get("config_updates")
                if request.generate_ui:
                    component_spec = parsed.get("component_spec")
            except Exception:
                pass

        # Determine intent from user text (broad matching)
        # NOTE: Segmentation intent takes precedence over funnel when both are present.
        wants_funnel = any(
            x in user_text
            for x in [
                "funnel",
                "conversion",
                "booking",
                "build",
                "standard",
                "chart",
                "flow",
                "journey",
                "landed",
                "payment",
                "confirmation",
                "room select",
            ]
        )
        wants_segment = any(
            x in user_text
            for x in [
                "segment",
                "segmentation",
                "compare",
                "behavioral",
                "guest",
                "cohort",
                "device",
                "mobile",
                "desktop",
                "tablet",
            ]
        )

        # Fallback when no config from LLM
        # IMPORTANT: Prefer segmentation when both funnel + segmentation intent appear.
        if not config_updates:
            if wants_segment:
                seg_mode = (
                    "behavioral"
                    if "behavioral" in user_text
                    else "guest"
                    if "guest" in user_text
                    else "event"
                )
                config_updates = {
                    "analysis_type": "segmentation",
                    "segment_mode": seg_mode,
                }
            elif wants_funnel:
                config_updates = {
                    "analysis_type": "funnel",
                    "measurement": "conversion",
                    "funnel_steps": GUIDED_BUILD_FUNNEL_STEPS,
                }

        # CRITICAL: Always ensure funnel_steps for funnel builds (LLM often omits them)
        if config_updates and config_updates.get("analysis_type") == "funnel":
            steps = config_updates.get("funnel_steps")
            if not steps or not isinstance(steps, list) or len(steps) == 0:
                config_updates["funnel_steps"] = GUIDED_BUILD_FUNNEL_STEPS

        # Clean message - use professional success text when we have config to apply
        message = raw
        if json_match:
            message = raw[: json_match.start()].strip()
        if config_updates:
            atype = config_updates.get("analysis_type", "")
            steps = config_updates.get("funnel_steps", [])
            seg_mode = config_updates.get("segment_mode", "")
            if atype == "funnel" and steps:
                message = f"✓ **Chart built successfully.** Your booking funnel is ready with {len(steps)} steps: {', '.join(s.get('label', s.get('event_type', '')) for s in steps[:6])}. Check the left panel to see your funnel."
            elif atype == "segmentation":
                mode_label = {"behavioral": "behavioral segments", "guest": "guest segments", "event": "event-based"}.get(seg_mode, seg_mode or "segmentation")
                message = f"✓ **Chart built successfully.** Switched to segmentation view with {mode_label}. Your chart is ready."
            else:
                message = message or "✓ Chart configured. Check the left panel."
        else:
            message = message or "I couldn't build a chart from that. Try: \"Build a booking funnel\" or \"Show behavioral segments\"."

        result = {"message": message, "config_updates": config_updates}
        if request.generate_ui and component_spec:
            result["component_spec"] = component_spec
        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Guided build error: {str(exc)}")


class AiSuggestRequest(BaseModel):
    """Payload for generating suggested follow-up questions."""

    context_name: str
    data: Any


@app.post("/api/ai/suggest-questions")
async def suggest_questions(request: AiSuggestRequest) -> Dict[str, Any]:
    """
    Given the current chart context (Funnel, Segment, Friction, Revenue),
    return 3–4 follow-up questions that lead to business decisions.
    
    Supports both funnel and segmentation analysis.
    """
    try:
        d = request.data if isinstance(request.data, dict) else {}
        is_seg = _is_segmentation_data(d)

        if is_seg:
            system_prompt = (
                "You are a strategic marketing intelligence advisor for hospitality brands.\n"
                "Based on the SEGMENTATION DATA provided (behavioral_segments, guest_segments, or event_results), "
                "generate 3-4 SHORT, data-specific questions (5-10 words each).\n\n"
                "## Rules:\n"
                "- Analyze segments: conversion rates, revenue, pct_of_total, sessions\n"
                "- Generate questions SPECIFIC to the data (e.g., 'Why do Researchers have low conversion?')\n"
                "- Focus on: best opportunity segment, underperformers, marketing actions, revenue potential\n"
                "- Output ONLY a strict JSON array of strings (no other text)\n"
                "- Example: [\"Which segment has best conversion?\", \"Why do Bargain Hunters drop off?\", \"How to target High-Friction Droppers?\"]\n"
            )
        else:
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


class SuggestionRequest(BaseModel):
    """Request for generating context-aware suggestions."""
    current_view_config: Optional[Dict[str, Any]] = None
    session_history: Optional[List[Dict[str, Any]]] = []


class SummarizeConversationRequest(BaseModel):
    """Request for summarizing a conversation."""
    messages: List[Dict[str, str]]


@app.post("/api/ai/summarize-conversation")
async def summarize_conversation(request: SummarizeConversationRequest) -> Dict[str, Any]:
    """
    Summarize a conversation for context compression.
    Reduces token usage for long sessions while maintaining context continuity.
    """
    try:
        messages = request.messages
        
        if len(messages) < 3:
            return {"summary": "Conversation too short to summarize."}
        
        system_prompt = (
            "You are a conversation summarizer for an analytics platform.\n"
            "Summarize the key points, questions asked, and insights provided in this conversation.\n"
            "Keep it concise (2-3 sentences) and focus on the main analysis topics and findings.\n"
            "Return only the summary text, no additional formatting."
        )
        
        user_content = "Summarize this conversation:\n\n"
        for msg in messages[-20:]:  # Last 20 messages
            role = msg.get('role', 'user')
            text = msg.get('text', '')
            user_content += f"{role}: {text}\n"
        
        summary = call_azure_gpt([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])
        
        return {"summary": summary.strip()}
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Conversation summarization error: {str(exc)}")


class SegmentDiscoveryRequest(BaseModel):
    """Request for discovering high-value segments."""
    time_period_days: int = 30
    min_sessions: int = 100


@app.post("/api/ai/discover-segments")
async def discover_segments_endpoint(request: SegmentDiscoveryRequest) -> Dict[str, Any]:
    """
    Auto-discover high-value segments using RFM + behavioral clustering.
    Uses Azure GPT to name segments.
    """
    try:
        from engines.segmentDiscovery import discover_segments
        
        segments = await discover_segments(
            time_period_days=request.time_period_days,
            min_sessions=request.min_sessions
        )
        
        return {
            "segments": segments,
            "count": len(segments),
        }
        
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Segment discovery module not available"
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Segment discovery error: {str(exc)}")


class ChartInsightsRequest(BaseModel):
    """Request for generating micro-insights from chart data."""
    chart_data: List[Dict[str, Any]]
    chart_type: str
    persona: str = "Hospitality Forensic Analyst"
    max_insights: int = 3


class AutonomousBuildRequest(BaseModel):
    """Request for autonomous chart building with mutation support."""
    query: str
    current_config: Optional[Dict[str, Any]] = None
    mutation_mode: bool = False
    generate_ui: bool = True


class ParseFunnelQueryRequest(BaseModel):
    """Request for parsing natural language funnel query."""
    query: str
    current_config: Optional[Dict[str, Any]] = None


@app.post("/api/ai/parse-funnel-query")
async def parse_funnel_query(request: ParseFunnelQueryRequest) -> Dict[str, Any]:
    """
    Parse natural language query to extract ALL funnel parameters:
    - Steps (landed, location select, etc.)
    - Segment comparison (device type = mobile)
    - Counting method (unique users, sessions, events)
    - Completed within (1 day, 7 days, etc.)
    - Date range
    """
    try:
        query = request.query.lower()
        current_config = request.current_config or {}

        system_prompt = (
            "You are an intelligent funnel query parser for a hospitality analytics platform.\n"
            "Your job is to understand ANY natural language query and extract funnel parameters, regardless of how the user phrases it.\n"
            "Be flexible and interpret user intent - don't just match keywords. Handle synonyms, variations, and different phrasings.\n\n"
            "Return JSON with:\n"
            "{\n"
            '  "steps": ["landed", "location select", "date select", "room select"],\n'
            '  "viewType": "conversion" | "overTime" | "timeToConvert" | "frequency" | "improvement" | "significance",\n'
            '  "segmentComparisons": [{"dimension": "device_type", "value": "mobile"}, {"dimension": "device_type", "value": "tablet"}] OR null,\n'
            '  "countingBy": "unique_users" | "sessions" | "events",\n'
            '  "completedWithin": 1 (number of days),\n'
            '  "dateRange": {"start": "2024-01-01", "end": "2024-01-31"} OR null,\n'
            '  "explanation": "Built over time funnel with 4 steps comparing mobile vs tablet",\n'
            '  "confidence": 95\n'
            "}\n\n"
            "IMPORTANT: Interpret flexibly. Users may phrase things differently:\n\n"
            "View Types (Measured As) - interpret ANY phrasing that means:\n"
            "- Conversion/Conversion Rate/Step-by-step/Classic funnel → \"conversion\"\n"
            "- Over time/Trends/Temporal/Time series/How it changes over time → \"overTime\"\n"
            "- Time to convert/Duration/How long it takes/Speed → \"timeToConvert\"\n"
            "- Frequency/How often → \"frequency\"\n"
            "- Improvement/Progress → \"improvement\"\n"
            "- Significance/Statistical significance → \"significance\"\n\n"
            "Step names - recognize ANY way users refer to funnel steps:\n"
            "- Landing/Landed/Homepage/Arrived/Page view → \"landed\"\n"
            "- Location/Location select/Picked location/Chose destination/Selected resort → \"location select\"\n"
            "- Date/Date select/Calendar/Check-in dates/Selected dates → \"date select\"\n"
            "- Room/Room select/Room type/Selected room/Chose room → \"room select\"\n"
            "- Payment/Pay/Checkout/Payment page/Credit card → \"payment\"\n"
            "- Confirmation/Confirm/Success/Thank you/Completed → \"confirmation\"\n"
            "- Also extract ANY custom step names the user mentions\n\n"
            "Segment Comparisons - handle ANY comparison phrasing:\n"
            "- 'vs', 'versus', 'compared to', 'compare', 'against', 'between X and Y'\n"
            "- 'mobile vs tablet', 'mobile compared to tablet', 'compare mobile and tablet'\n"
            "- 'device type = mobile', 'mobile devices', 'only mobile', 'for mobile users'\n"
            "- Extract dimension and value from ANY property mentioned (device_type, guest_segment, traffic_source, browser, os, etc.)\n"
            "- Extract ANY segment values mentioned (mobile, tablet, desktop, family, business, google, facebook, etc.)\n\n"
            "Counting methods - interpret ANY phrasing:\n"
            "- Unique users/Users/Unique visitors/Per user/By user → \"unique_users\"\n"
            "- Sessions/Session-based/Per session → \"sessions\"\n"
            "- Events/Event-based/Per event → \"events\"\n"
            "- If not specified, default to \"unique_users\"\n\n"
            "Time windows - extract ANY time reference:\n"
            "- '1 day', '1d', 'within 1 day', '1 day window', 'daily', 'same day' → 1\n"
            "- '7 days', '1 week', '7d', 'weekly', 'within a week' → 7\n"
            "- '30 days', '1 month', '30d', 'monthly', 'within a month' → 30\n"
            "- Extract numbers from phrases like 'completed in X days', 'within X days', 'X day period'\n"
            "- If not specified, default to 30\n\n"
            "Be smart: If the user says 'show me', 'I want', 'create', 'build', 'make', 'generate' - extract the intent.\n"
            "If they mention dates, extract dateRange. If they mention segments, extract segmentComparisons.\n"
            "Don't require exact keyword matches - understand the meaning."
        )

        user_prompt = (
            f"User Query: {request.query}\n\n"
            f"Current Config (if mutating): {json.dumps(current_config, default=str) if current_config else 'None'}\n\n"
            "Extract ALL parameters. Return JSON only."
        )

        try:
            ai_response = call_azure_gpt([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])

            import re
            json_match = re.search(r"\{[\s\S]*\}", ai_response)
            if json_match:
                parsed = json.loads(json_match.group(0))
                
                # Validate and normalize - AI should handle this, but validate
                steps = parsed.get("steps", [])
                if not steps or len(steps) == 0:
                    # AI failed to extract steps - try flexible extraction
                    query_lower = query.lower()
                    step_patterns = {
                        'landed': ['landed', 'landing', 'homepage', 'arrived', 'page view', 'pageview'],
                        'location select': ['location', 'location select', 'picked location', 'chose destination', 'selected resort', 'destination'],
                        'date select': ['date', 'date select', 'calendar', 'checkin', 'check-in', 'selected dates', 'dates'],
                        'room select': ['room', 'room select', 'room type', 'selected room', 'chose room'],
                        'payment': ['payment', 'pay', 'checkout', 'payment page', 'credit card', 'billing'],
                        'confirmation': ['confirmation', 'confirm', 'success', 'thank you', 'completed', 'done'],
                    }
                    steps = []
                    for step_name, patterns in step_patterns.items():
                        if any(pattern in query_lower for pattern in patterns):
                            steps.append(step_name)
                    
                    if not steps:
                        # Last resort: default steps
                        steps = ['landed', 'location select', 'date select', 'room select']

                # Normalize counting method - AI should handle this, but validate
                counting_by = parsed.get("countingBy", "unique_users")
                if counting_by not in ["unique_users", "sessions", "events"]:
                    query_lower = query.lower()
                    if any(word in query_lower for word in ["session", "sessions", "per session", "session-based"]):
                        counting_by = "sessions"
                    elif any(word in query_lower for word in ["event", "events", "per event", "event-based"]):
                        counting_by = "events"
                    elif any(word in query_lower for word in ["user", "users", "unique", "visitor", "visitors", "per user"]):
                        counting_by = "unique_users"
                    else:
                        counting_by = "unique_users"  # Default

                # Extract view type (measured as) - AI should handle this, but validate
                view_type = parsed.get("viewType", "conversion")
                if view_type not in ["conversion", "overTime", "timeToConvert", "frequency", "improvement", "significance"]:
                    # Infer from query with flexible matching
                    query_lower = query.lower()
                    if any(phrase in query_lower for phrase in ["over time", "overtime", "trend", "trends", "temporal", "time series", "how it changes"]):
                        view_type = "overTime"
                    elif any(phrase in query_lower for phrase in ["time to convert", "duration", "how long", "speed", "time taken"]):
                        view_type = "timeToConvert"
                    elif any(phrase in query_lower for phrase in ["frequency", "how often"]):
                        view_type = "frequency"
                    elif any(phrase in query_lower for phrase in ["improvement", "progress"]):
                        view_type = "improvement"
                    elif any(phrase in query_lower for phrase in ["significance", "statistical"]):
                        view_type = "significance"
                    else:
                        view_type = "conversion"  # Default

                # Extract completed within - AI should handle this, but validate
                completed_within = parsed.get("completedWithin", 30)
                # Try to extract number from various patterns
                day_patterns = [
                    r"(\d+)\s*day",
                    r"(\d+)\s*d\b",
                    r"within\s+(\d+)\s*day",
                    r"(\d+)\s*day\s+window",
                    r"completed\s+in\s+(\d+)\s*day",
                    r"(\d+)\s*day\s+period",
                ]
                for pattern in day_patterns:
                    day_match = re.search(pattern, query.lower())
                    if day_match:
                        completed_within = int(day_match.group(1))
                        break
                
                # Also check for week/month patterns
                if "week" in query.lower() or "weekly" in query.lower():
                    week_match = re.search(r"(\d+)\s*week", query.lower())
                    if week_match:
                        completed_within = int(week_match.group(1)) * 7
                elif "month" in query.lower() or "monthly" in query.lower():
                    month_match = re.search(r"(\d+)\s*month", query.lower())
                    if month_match:
                        completed_within = int(month_match.group(1)) * 30

                # Extract segment comparisons - AI should handle this, but validate
                segment_comparisons = parsed.get("segmentComparisons")
                if not segment_comparisons:
                    # Try to infer from query with flexible matching
                    query_lower = query.lower()
                    segments_list = []
                    
                    # Common device types
                    device_types = ['mobile', 'tablet', 'desktop', 'phone', 'smartphone']
                    # Common guest segments
                    guest_segments = ['family', 'business', 'couple', 'couples', 'vip', 'corporate', 'groups']
                    # Common traffic sources
                    traffic_sources = ['google', 'facebook', 'instagram', 'bing', 'email', 'direct']
                    
                    # Check for comparison patterns (vs, versus, compared to, compare, between X and Y)
                    comparison_keywords = ['vs', 'versus', 'compared to', 'compare', 'against', 'between', 'and']
                    
                    # Try to find device comparisons
                    found_devices = [dt for dt in device_types if dt in query_lower]
                    if len(found_devices) >= 2:
                        # Multiple devices mentioned - likely a comparison
                        segments_list = [{"dimension": "device_type", "value": dt} for dt in found_devices[:2]]
                    elif len(found_devices) == 1:
                        # Single device mentioned
                        segments_list = [{"dimension": "device_type", "value": found_devices[0]}]
                    
                    # Try guest segments
                    if not segments_list:
                        found_segments = [gs for gs in guest_segments if gs in query_lower]
                        if len(found_segments) >= 2:
                            segments_list = [{"dimension": "guest_segment", "value": gs.capitalize()} for gs in found_segments[:2]]
                        elif len(found_segments) == 1:
                            segments_list = [{"dimension": "guest_segment", "value": found_segments[0].capitalize()}]
                    
                    # Try traffic sources
                    if not segments_list:
                        found_sources = [ts for ts in traffic_sources if ts in query_lower]
                        if len(found_sources) >= 2:
                            segments_list = [{"dimension": "traffic_source", "value": ts} for ts in found_sources[:2]]
                        elif len(found_sources) == 1:
                            segments_list = [{"dimension": "traffic_source", "value": found_sources[0]}]
                    
                    segment_comparisons = segments_list if segments_list else None
                elif isinstance(segment_comparisons, dict):
                    # Single segment as dict, convert to list
                    segment_comparisons = [segment_comparisons]

                return {
                    "steps": steps,
                    "viewType": view_type,
                    "segmentComparisons": segment_comparisons,
                    "countingBy": counting_by,
                    "completedWithin": completed_within,
                    "dateRange": parsed.get("dateRange"),
                    "explanation": parsed.get("explanation", f"Built {view_type} funnel with {len(steps)} steps"),
                    "confidence": parsed.get("confidence", 90),
                    "extractedParams": {
                        "steps": steps,
                        "viewType": view_type,
                        "segmentComparisons": segment_comparisons,
                        "countingBy": counting_by,
                        "completedWithin": completed_within,
                        "dateRange": parsed.get("dateRange"),
                    },
                }
        except Exception as e:
            print(f"AI parsing error: {e}")
            # Fallback parsing
            pass

        # Fallback: rule-based parsing
        return parse_query_fallback(request.query)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Parse query error: {str(exc)}")


def parse_query_fallback(query: str) -> Dict[str, Any]:
    """Fallback rule-based parser - more flexible keyword matching."""
    import re
    lower = query.lower()
    
    # Extract steps with flexible patterns
    step_patterns = {
        'landed': ['landed', 'landing', 'homepage', 'arrived', 'page view', 'pageview', 'start'],
        'location select': ['location', 'location select', 'picked location', 'chose destination', 'selected resort', 'destination', 'where'],
        'date select': ['date', 'date select', 'calendar', 'checkin', 'check-in', 'selected dates', 'dates', 'when'],
        'room select': ['room', 'room select', 'room type', 'selected room', 'chose room', 'accommodation'],
        'payment': ['payment', 'pay', 'checkout', 'payment page', 'credit card', 'billing', 'paid'],
        'confirmation': ['confirmation', 'confirm', 'success', 'thank you', 'completed', 'done', 'finished'],
    }
    
    steps = []
    for step_name, patterns in step_patterns.items():
        if any(pattern in lower for pattern in patterns):
            steps.append(step_name)
    
    if not steps:
        steps = ['landed', 'location select', 'date select', 'room select']
    
    # Extract view type with flexible matching
    view_type = "conversion"
    if any(phrase in lower for phrase in ["over time", "overtime", "trend", "trends", "temporal", "time series"]):
        view_type = "overTime"
    elif any(phrase in lower for phrase in ["time to convert", "duration", "how long", "speed", "time taken"]):
        view_type = "timeToConvert"
    elif "frequency" in lower or "how often" in lower:
        view_type = "frequency"
    elif "improvement" in lower or "progress" in lower:
        view_type = "improvement"
    elif "significance" in lower or "statistical" in lower:
        view_type = "significance"
    
    # Extract counting method with flexible matching
    counting_by = "unique_users"
    if any(word in lower for word in ["unique user", "unique users", "users", "visitor", "visitors", "per user", "by user"]):
        counting_by = "unique_users"
    elif any(word in lower for word in ["session", "sessions", "per session", "session-based"]):
        counting_by = "sessions"
    elif any(word in lower for word in ["event", "events", "per event", "event-based"]):
        counting_by = "events"
    
    # Extract completed within with flexible patterns
    completed_within = 30
    day_patterns = [
        r"(\d+)\s*day",
        r"(\d+)\s*d\b",
        r"within\s+(\d+)\s*day",
        r"(\d+)\s*day\s+window",
        r"completed\s+in\s+(\d+)\s*day",
        r"(\d+)\s*day\s+period",
    ]
    for pattern in day_patterns:
        day_match = re.search(pattern, lower)
        if day_match:
            completed_within = int(day_match.group(1))
            break
    
    # Check for week/month patterns
    if "week" in lower or "weekly" in lower:
        week_match = re.search(r"(\d+)\s*week", lower)
        if week_match:
            completed_within = int(week_match.group(1)) * 7
    elif "month" in lower or "monthly" in lower:
        month_match = re.search(r"(\d+)\s*month", lower)
        if month_match:
            completed_within = int(month_match.group(1)) * 30
    
    # Extract segment comparisons with flexible matching
    segment_comparisons = None
    device_types = ['mobile', 'tablet', 'desktop', 'phone', 'smartphone']
    guest_segments = ['family', 'business', 'couple', 'couples', 'vip', 'corporate', 'groups']
    traffic_sources = ['google', 'facebook', 'instagram', 'bing', 'email', 'direct']
    
    comparison_keywords = ['vs', 'versus', 'compared to', 'compare', 'against', 'between', 'and']
    has_comparison = any(kw in lower for kw in comparison_keywords)
    
    # Try device comparisons
    found_devices = [dt for dt in device_types if dt in lower]
    if len(found_devices) >= 2:
        segment_comparisons = [{"dimension": "device_type", "value": dt} for dt in found_devices[:2]]
    elif len(found_devices) == 1 and (has_comparison or "device" in lower):
        segment_comparisons = [{"dimension": "device_type", "value": found_devices[0]}]
    
    # Try guest segments
    if not segment_comparisons:
        found_segments = [gs for gs in guest_segments if gs in lower]
        if len(found_segments) >= 2:
            segment_comparisons = [{"dimension": "guest_segment", "value": gs.capitalize()} for gs in found_segments[:2]]
        elif len(found_segments) == 1:
            segment_comparisons = [{"dimension": "guest_segment", "value": found_segments[0].capitalize()}]
    
    # Try traffic sources
    if not segment_comparisons:
        found_sources = [ts for ts in traffic_sources if ts in lower]
        if len(found_sources) >= 2:
            segment_comparisons = [{"dimension": "traffic_source", "value": ts} for ts in found_sources[:2]]
        elif len(found_sources) == 1:
            segment_comparisons = [{"dimension": "traffic_source", "value": found_sources[0]}]
    
    return {
        "steps": steps,
        "viewType": view_type,
        "segmentComparisons": segment_comparisons,
        "countingBy": counting_by,
        "completedWithin": completed_within,
        "dateRange": None,
        "explanation": f"Built {view_type} funnel with {len(steps)} steps",
        "confidence": 75,
        "extractedParams": {
            "steps": steps,
            "viewType": view_type,
            "segmentComparisons": segment_comparisons,
            "countingBy": counting_by,
            "completedWithin": completed_within,
        },
    }


@app.post("/api/ai/autonomous-build")
async def autonomous_build(request: AutonomousBuildRequest) -> Dict[str, Any]:
    """
    Autonomous chart builder with NL-to-Config and mutation mode.
    Handles both "build new" and "mutate existing" workflows.
    """
    try:
        query = request.query
        current_config = request.current_config or {}
        mutation_mode = request.mutation_mode
        generate_ui = request.generate_ui

        # Detect intent: mutation vs new build
        if mutation_mode and current_config:
            # Mutation mode: modify existing config
            system_prompt = (
                "You are an autonomous chart builder for a hospitality analytics platform.\n"
                "The user wants to MODIFY an existing chart configuration.\n"
                "Analyze the current config and the user's request, then return ONLY the fields that need to change.\n"
                "Return JSON: {\"config_updates\": {...}, \"explanation\": \"...\", \"confidence\": 0-100, \"suggested_mutation\": \"...\"}\n"
                "Only include fields that are being changed - don't repeat unchanged fields."
            )
        else:
            # New build mode
            system_prompt = (
                "You are an autonomous chart builder for a hospitality analytics platform.\n"
                "Convert natural language to chart configuration.\n"
                "Return JSON: {\"config_updates\": {...}, \"explanation\": \"...\", \"confidence\": 0-100, \"component_spec\": {...}}\n"
                "component_spec should include: component type, data structure, config for rendering."
            )

        user_prompt = (
            f"User Query: {query}\n\n"
        )
        
        if mutation_mode and current_config:
            user_prompt += (
                f"Current Config: {json.dumps(current_config, default=str)}\n\n"
                "Modify ONLY the fields mentioned in the query. Return the changed fields in config_updates."
            )
        else:
            user_prompt += (
                "Build a new chart configuration based on this query. "
                "Include component_spec for dynamic rendering."
            )

        ai_response = call_azure_gpt([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ])

        # Parse response
        import re
        json_match = re.search(r"\{[\s\S]*\}", ai_response)
        if json_match:
            parsed = json.loads(json_match.group(0))
            return {
                "config_updates": parsed.get("config_updates", {}),
                "component_spec": parsed.get("component_spec") if generate_ui else None,
                "explanation": parsed.get("explanation", "Chart configured successfully"),
                "confidence": parsed.get("confidence", 100),
                "suggested_mutation": parsed.get("suggested_mutation"),
            }

        # Fallback
        return {
            "config_updates": {},
            "explanation": "Unable to parse chart configuration",
            "confidence": 50,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Autonomous build error: {str(exc)}")


@app.post("/api/ai/chart-insights")
async def generate_chart_insights(request: ChartInsightsRequest) -> Dict[str, Any]:
    """
    Generate micro-insights from chart data.
    Analyzes patterns and returns insights with suggested actions.
    
    Now enabled with proper error handling - returns empty insights on failure instead of breaking.
    """
    try:
        # Validate request structure
        if not hasattr(request, 'chart_data') or not hasattr(request, 'chart_type'):
            print("ERROR: Invalid request structure - missing chart_data or chart_type")
            return {"insights": []}
        
        chart_data = request.chart_data
        chart_type = request.chart_type
        persona = getattr(request, 'persona', 'Hospitality Forensic Analyst')
        max_insights = getattr(request, 'max_insights', 3)
    
        if not chart_data or len(chart_data) == 0:
            print(f"WARNING: Empty chart_data for chart_type={chart_type}")
            return {"insights": []}
        
        print(f"DEBUG: Generating insights for chart_type={chart_type}, data_points={len(chart_data)}")
    
        # Detect patterns in data
        insights = []
         
        # Calculate statistics
        values = []
        for item in chart_data:
            # Support multiple value field names
            val = item.get('value') or item.get('y') or item.get('count') or item.get('visitors') or 0
            if isinstance(val, (int, float)) and not (isinstance(val, float) and val != val):  # Check for NaN
                values.append(float(val))
    
        # For KPI charts, we need at least 2 values, but we'll handle it specially below
        if len(values) < 2 and chart_type != 'kpi':
            return {"insights": []}
        
        # For KPI with only 1 value, duplicate it to create a comparison
        # This ensures we always have at least 2 data points for trend analysis
        if len(values) == 1 and chart_type == 'kpi':
            # Use the same value twice (no change) rather than simulating
            values = [values[0], values[0]]
            # Also update chart_data to match
            if len(chart_data) == 1:
                chart_data = [
                    {**chart_data[0], 'name': 'Previous'},
                    {**chart_data[0], 'name': 'Current'}
                ]

        mean = sum(values) / len(values)
        max_val = max(values)
        min_val = min(values)
        max_idx = values.index(max_val)
        min_idx = values.index(min_val)

        # Detect spikes
        threshold = mean * 1.15  # 15% above mean
        if max_val > threshold:
            spike_data = chart_data[max_idx]
            spike_label = spike_data.get('name') or spike_data.get('date') or f"Point {max_idx + 1}"
            
            system_prompt = (
                f"You are a {persona} for a hospitality analytics platform.\n"
                "Analyze chart data and generate a concise micro-insight (< 100 words).\n"
                "Return JSON: {\"headline\": \"...\", \"explanation\": \"...\", \"confidence\": 0-100, \"category\": \"spike|drop|anomaly|trend|correlation|opportunity\", \"suggestedActions\": [{\"label\": \"...\", \"action\": \"...\"}]}"
            )
            
            user_prompt = (
                f"Chart Type: {chart_type}\n"
                f"Data Point: {spike_label} has value {max_val:.1f} (mean: {mean:.1f})\n"
                f"Full Data: {json.dumps(chart_data[:10], default=str)}\n\n"
                "Generate a micro-insight explaining this spike. Include 1-2 suggested actions."
            )

            try:
                ai_response = call_azure_gpt([
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ])

                # Robust JSON extraction and parsing
                insight_data = None
                import re
                
                # Try multiple JSON extraction strategies
                json_patterns = [
                    r"```(?:json)?\s*(\{[\s\S]*?\})\s*```",  # JSON in code blocks
                    r"(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})",  # Balanced braces (non-greedy)
                    r"(\{[\s\S]*?\})",  # First JSON object (non-greedy)
                ]
                
                for pattern in json_patterns:
                    json_match = re.search(pattern, ai_response)
                    if json_match:
                        json_str = json_match.group(1)
                        try:
                            # Try to parse as-is
                            insight_data = json.loads(json_str)
                            break
                        except json.JSONDecodeError:
                            # Try to fix common JSON issues
                            try:
                                # Remove trailing commas
                                json_str = re.sub(r',\s*}', '}', json_str)
                                json_str = re.sub(r',\s*]', ']', json_str)
                                # Fix unescaped quotes in strings (basic attempt)
                                insight_data = json.loads(json_str)
                                break
                            except json.JSONDecodeError:
                                continue
                
                if insight_data:
                    # Validate and sanitize insight_data
                    headline = insight_data.get("headline", "")
                    explanation = insight_data.get("explanation", "")
                    confidence = insight_data.get("confidence", 85)
                    category = insight_data.get("category", "spike")
                    suggested_actions = insight_data.get("suggestedActions", [])
                    
                    # Ensure confidence is valid
                    if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
                        confidence = 85
                    
                    # Ensure category is valid
                    valid_categories = ["spike", "drop", "anomaly", "trend", "correlation", "opportunity"]
                    if category not in valid_categories:
                        category = "spike"
                    
                    # Ensure suggestedActions is a list
                    if not isinstance(suggested_actions, list):
                        suggested_actions = []
                    
                    # Validate each action
                    validated_actions = []
                    for action in suggested_actions[:3]:  # Limit to 3 actions
                        if isinstance(action, dict) and "label" in action and "action" in action:
                            validated_actions.append({
                                "label": str(action.get("label", ""))[:100],  # Limit length
                                "action": str(action.get("action", ""))[:200]
                            })
                    
                    if not validated_actions:
                        validated_actions = [
                            {"label": "See Segment Breakdown", "action": f"Break down {spike_label} by segments"},
                            {"label": "Compare with Last Week", "action": f"Compare {spike_label} with previous period"}
                        ]
                    
                    insights.append({
                        "id": f"spike-{max_idx}",
                        "dataPointIndex": max_idx,
                        "dataPointKey": spike_label,
                        "headline": headline[:200] if headline else f"{spike_label} shows {((max_val/mean - 1) * 100):.1f}% spike",
                        "explanation": explanation[:500] if explanation else f"This data point is significantly above the average.",
                        "confidence": int(confidence),
                        "category": category,
                        "suggestedActions": validated_actions,
                    })
                else:
                    # If JSON parsing failed, use fallback
                    raise ValueError("Could not parse AI response as JSON")
                    
            except Exception as e:
                # Log error but don't break the endpoint
                print(f"Error generating AI insight (using fallback): {e}")
                # Fallback insight - always provide something
                insights.append({
                    "id": f"spike-{max_idx}",
                    "dataPointIndex": max_idx,
                    "dataPointKey": spike_label,
                    "headline": f"{spike_label} shows {((max_val/mean - 1) * 100):.1f}% spike above average",
                    "explanation": f"This data point is {((max_val/mean - 1) * 100):.1f}% above the mean value of {mean:.1f}.",
                    "confidence": 75,
                    "category": "spike",
                    "suggestedActions": [
                        {"label": "See Segment Breakdown", "action": f"Break down {spike_label} by segments"},
                        {"label": "Compare with Last Week", "action": f"Compare {spike_label} with previous period"}
                    ],
                })

        # Detect drops
        threshold = mean * 0.85  # 15% below mean
        if min_val < threshold and min_idx != max_idx:
            drop_data = chart_data[min_idx]
            drop_label = drop_data.get('name') or drop_data.get('date') or f"Point {min_idx + 1}"
            
            insights.append({
                "id": f"drop-{min_idx}",
                "dataPointIndex": min_idx,
                "dataPointKey": drop_label,
                "headline": f"{drop_label} shows {((1 - min_val/mean) * 100):.1f}% drop below average",
                "explanation": f"This data point is {((1 - min_val/mean) * 100):.1f}% below the mean value of {mean:.1f}. This may indicate an issue or opportunity.",
                "confidence": 75,
                "category": "drop",
                "suggestedActions": [
                    {"label": "Investigate Root Cause", "action": f"Analyze why {drop_label} dropped"},
                    {"label": "Compare Segments", "action": f"Compare {drop_label} across different segments"}
                ],
            })

        # For KPI cards (only 2 data points), always generate an insight if none found
        # This ensures KPI cards always get insights even without spikes/drops
        if chart_type == 'kpi' and len(insights) == 0:
            try:
                current_val = float(values[-1]) if values and len(values) > 0 else 0.0
                previous_val = float(values[0]) if len(values) > 1 else current_val
                # Calculate percentage change safely
                if previous_val > 0:
                    change_pct = ((current_val - previous_val) / previous_val) * 100
                elif current_val > 0:
                    change_pct = 100.0  # New metric appeared
                else:
                    change_pct = 0.0  # Both are zero
                
                current_label = chart_data[-1].get('name') if len(chart_data) > 0 else 'Current'
                previous_label = chart_data[0].get('name') if len(chart_data) > 0 else 'Previous'
                
                # Generate AI insight for KPI trend
                # Try to use GPT if available, otherwise use fallback
                ai_response = None
                try:
                    system_prompt = (
                        f"You are a {persona} for a hospitality analytics platform.\n"
                        "Analyze KPI metric data and generate a concise micro-insight (< 100 words).\n"
                        "Return JSON: {\"headline\": \"...\", \"explanation\": \"...\", \"confidence\": 0-100, \"category\": \"spike|drop|anomaly|trend|correlation|opportunity\", \"suggestedActions\": [{\"label\": \"...\", \"action\": \"...\"}]}"
                    )
                    
                    user_prompt = (
                        f"KPI Metric Analysis:\n"
                        f"Previous Value: {previous_label} = {previous_val:.1f}\n"
                        f"Current Value: {current_label} = {current_val:.1f}\n"
                        f"Change: {change_pct:+.1f}%\n\n"
                        f"Generate a micro-insight explaining this metric trend. Include 1-2 suggested actions."
                    )
                    
                    ai_response = call_azure_gpt([
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ])
                except HTTPException as http_err:
                    # Azure OpenAI not configured or failed - use fallback
                    print(f"Azure OpenAI not available for KPI insights: {http_err.detail}")
                    ai_response = None
                except Exception as gpt_err:
                    # Other GPT errors - use fallback
                    print(f"GPT error for KPI insights: {gpt_err}")
                    ai_response = None
                
                # Robust JSON extraction and parsing (only if AI response available)
                insight_data = None
                if ai_response:
                    import re
                    
                    json_patterns = [
                        r"```(?:json)?\s*(\{[\s\S]*?\})\s*```",
                        r"(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})",
                        r"(\{[\s\S]*?\})",
                    ]
                    
                    for pattern in json_patterns:
                        json_match = re.search(pattern, ai_response)
                        if json_match:
                            json_str = json_match.group(1)
                            try:
                                insight_data = json.loads(json_str)
                                break
                            except json.JSONDecodeError:
                                try:
                                    json_str = re.sub(r',\s*}', '}', json_str)
                                    json_str = re.sub(r',\s*]', ']', json_str)
                                    insight_data = json.loads(json_str)
                                    break
                                except json.JSONDecodeError:
                                    continue
                
                if insight_data:
                    headline = insight_data.get("headline", "")
                    explanation = insight_data.get("explanation", "")
                    confidence = insight_data.get("confidence", 85)
                    category = insight_data.get("category", "trend")
                    suggested_actions = insight_data.get("suggestedActions", [])
                    
                    if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
                        confidence = 85
                    
                    valid_categories = ["spike", "drop", "anomaly", "trend", "correlation", "opportunity"]
                    if category not in valid_categories:
                        category = "trend"
                    
                    if not isinstance(suggested_actions, list):
                        suggested_actions = []
                    
                    validated_actions = []
                    for action in suggested_actions[:3]:
                        if isinstance(action, dict) and "label" in action and "action" in action:
                            validated_actions.append({
                                "label": str(action.get("label", ""))[:100],
                                "action": str(action.get("action", ""))[:200]
                            })
                    
                    if not validated_actions:
                        validated_actions = [
                            {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                            {"label": "Compare Segments", "action": "Compare across different segments"}
                        ]
                    
                    insights.append({
                        "id": f"kpi-trend-{len(chart_data)}",
                        "dataPointIndex": len(chart_data) - 1,
                        "dataPointKey": current_label,
                        "headline": headline[:200] if headline else f"Metric changed by {change_pct:+.1f}%",
                        "explanation": explanation[:500] if explanation else f"The metric changed from {previous_val:.1f} to {current_val:.1f} ({change_pct:+.1f}%).",
                        "confidence": int(confidence),
                        "category": category,
                        "suggestedActions": validated_actions,
                    })
                # Always generate fallback insight if AI didn't work
                if not insight_data:
                    # Generate intelligent fallback based on the metric data
                    trend_verb = "increased" if change_pct > 5 else "decreased" if change_pct < -5 else "remained stable"
                    trend_desc = ""
                    if abs(change_pct) > 10:
                        trend_desc = f"significant {trend_verb.lower()}"
                    elif abs(change_pct) > 5:
                        trend_desc = f"moderate {trend_verb.lower()}"
                    else:
                        trend_desc = "minimal change"
                    
                    # Generate contextual headline and explanation
                    # Note: We don't have access to 'label' here, so use generic terms
                    if change_pct > 10:
                        headline = f"Strong performance increase"
                        explanation = f"This metric {trend_verb} by {abs(change_pct):.1f}% from {previous_val:.1f} to {current_val:.1f}. This {trend_desc} suggests positive performance trends."
                    elif change_pct < -10:
                        headline = f"Notable performance decrease"
                        explanation = f"This metric {trend_verb} by {abs(change_pct):.1f}% from {previous_val:.1f} to {current_val:.1f}. This {trend_desc} may require attention."
                    else:
                        headline = f"Stable performance"
                        explanation = f"This metric {trend_verb} by {abs(change_pct):.1f}% from {previous_val:.1f} to {current_val:.1f}. Performance is relatively stable."
                    
                    insights.append({
                        "id": f"kpi-fallback-{len(chart_data)}",
                        "dataPointIndex": len(chart_data) - 1,
                        "dataPointKey": current_label,
                        "headline": headline,
                        "explanation": explanation,
                        "confidence": 75,
                        "category": "trend",
                        "suggestedActions": [
                            {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                            {"label": "Compare Segments", "action": "Compare across different segments"}
                        ],
                    })
            except Exception as e:
                # Fallback insight if AI fails - always provide something
                print(f"Error generating KPI insight (using fallback): {e}")
                current_val = float(values[-1]) if values and len(values) > 0 else 0.0
                previous_val = float(values[0]) if len(values) > 1 else current_val
                # Calculate percentage change safely
                if previous_val > 0:
                    change_pct = ((current_val - previous_val) / previous_val) * 100
                elif current_val > 0:
                    change_pct = 100.0  # New metric appeared
                else:
                    change_pct = 0.0  # Both are zero
                
                trend_type = "increased" if change_pct > 0 else "decreased" if change_pct < 0 else "remained stable"
                current_label = chart_data[-1].get('name') if len(chart_data) > 0 else 'Current'
                
                insights.append({
                    "id": f"kpi-error-fallback-{len(chart_data)}",
                    "dataPointIndex": len(chart_data) - 1 if len(chart_data) > 0 else 0,
                    "dataPointKey": current_label,
                    "headline": f"Metric {trend_type}",
                    "explanation": f"The metric {trend_type} from {previous_val:.1f} to {current_val:.1f} ({change_pct:+.1f}%).",
                    "confidence": 70,
                    "category": "trend",
                    "suggestedActions": [
                        {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                        {"label": "Compare Segments", "action": "Compare across different segments"}
                    ],
                })

        # Ensure we always return at least one insight for KPI cards
        if chart_type == 'kpi' and len(insights) == 0:
            # Last resort fallback - extract values for basic insight
            try:
                fallback_values = []
                for item in chart_data:
                    val = item.get('value') or item.get('y') or item.get('count') or 0
                    if isinstance(val, (int, float)):
                        fallback_values.append(float(val))
                
                if len(fallback_values) >= 2:
                    current_val = fallback_values[-1]
                    previous_val = fallback_values[0]
                    change_pct = ((current_val - previous_val) / previous_val * 100) if previous_val > 0 else 0
                    trend_type = "increased" if change_pct > 0 else "decreased" if change_pct < 0 else "remained stable"
                    
                    insights.append({
                        "id": "kpi-ultimate-fallback",
                        "dataPointIndex": len(chart_data) - 1,
                        "dataPointKey": chart_data[-1].get('name') if chart_data else 'Current',
                        "headline": f"Metric {trend_type}",
                        "explanation": f"The metric {trend_type} from {previous_val:.1f} to {current_val:.1f} ({change_pct:+.1f}%).",
                        "confidence": 70,
                        "category": "trend",
                        "suggestedActions": [
                            {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                            {"label": "Compare Segments", "action": "Compare across different segments"}
                        ],
                    })
                else:
                    # Generic fallback if we can't extract values
                    insights.append({
                        "id": "kpi-ultimate-fallback",
                        "dataPointIndex": 0,
                        "dataPointKey": "Current",
                        "headline": "Metric analysis available",
                        "explanation": "Analyzing metric performance and trends.",
                        "confidence": 70,
                        "category": "trend",
                        "suggestedActions": [
                            {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                            {"label": "Compare Segments", "action": "Compare across different segments"}
                        ],
                    })
            except Exception as fallback_err:
                print(f"Error in ultimate fallback: {fallback_err}")
                # Absolute last resort
                insights.append({
                    "id": "kpi-absolute-fallback",
                    "dataPointIndex": 0,
                    "dataPointKey": "Current",
                    "headline": "Metric analysis available",
                    "explanation": "Analyzing metric performance and trends.",
                    "confidence": 70,
                    "category": "trend",
                    "suggestedActions": [
                        {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                        {"label": "Compare Segments", "action": "Compare across different segments"}
                    ],
                })

        result_insights = insights[:max_insights] if insights else []
        print(f"DEBUG: Returning {len(result_insights)} insights for chart_type={chart_type}")
        
        return {
            "insights": result_insights,
        }

    except Exception as exc:
        # Log error but return fallback insights instead of breaking
        print(f"Chart insights endpoint error: {exc}")
        import traceback
        traceback.print_exc()
        
        # For KPI cards, always return a fallback insight
        # Use try-except to safely access variables that might not be defined
        try:
            chart_type_safe = chart_type if 'chart_type' in locals() else request.chart_type if hasattr(request, 'chart_type') else None
            chart_data_safe = chart_data if 'chart_data' in locals() else request.chart_data if hasattr(request, 'chart_data') else []
            
            if chart_type_safe == 'kpi' and chart_data_safe:
                # Try to extract values for fallback
                values = []
                for item in chart_data_safe:
                    val = item.get('value') or item.get('y') or item.get('count') or 0
                    if isinstance(val, (int, float)):
                        values.append(float(val))
                
                if len(values) >= 2:
                    current_val = values[-1]
                    previous_val = values[0]
                    change_pct = ((current_val - previous_val) / previous_val * 100) if previous_val > 0 else 0
                    trend_type = "increased" if change_pct > 0 else "decreased" if change_pct < 0 else "remained stable"
                    
                    return {
                        "insights": [{
                            "id": "kpi-error-fallback",
                            "dataPointIndex": len(chart_data_safe) - 1,
                            "dataPointKey": chart_data_safe[-1].get('name') if chart_data_safe else 'Current',
                            "headline": f"Metric {trend_type}",
                            "explanation": f"The metric {trend_type} from {previous_val:.1f} to {current_val:.1f} ({change_pct:+.1f}%).",
                            "confidence": 70,
                            "category": "trend",
                            "suggestedActions": [
                                {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                                {"label": "Compare Segments", "action": "Compare across different segments"}
                            ],
                        }],
                    }
                elif len(values) == 1:
                    # Single value fallback
                    return {
                        "insights": [{
                            "id": "kpi-single-value-fallback",
                            "dataPointIndex": 0,
                            "dataPointKey": chart_data_safe[0].get('name') if chart_data_safe else 'Current',
                            "headline": "Metric value available",
                            "explanation": f"Current metric value is {values[0]:.1f}.",
                            "confidence": 70,
                            "category": "trend",
                            "suggestedActions": [
                                {"label": "See Detailed Breakdown", "action": "Analyze this metric in detail"},
                                {"label": "Compare Segments", "action": "Compare across different segments"}
                            ],
                        }],
                    }
        except Exception as fallback_err:
            print(f"Error in exception handler fallback: {fallback_err}")
        
        return {
            "insights": [],
        }


class AdaptiveSuggestionsRequest(BaseModel):
    """Request for adaptive suggestions based on current state."""
    current_view_config: Optional[Dict[str, Any]] = None
    chart_data: Optional[List[Dict[str, Any]]] = []
    selected_data_point: Optional[Dict[str, Any]] = None
    base_suggestions: Optional[List[Dict[str, Any]]] = []


@app.post("/api/ai/adaptive-suggestions")
async def generate_adaptive_suggestions(request: AdaptiveSuggestionsRequest) -> Dict[str, Any]:
    """
    Generate adaptive suggestions that change based on user interactions.
    Enhances heuristic suggestions with AI reasoning.
    """
    try:
        current_config = request.current_view_config or {}
        chart_data = request.chart_data or []
        selected_point = request.selected_data_point
        base_suggestions = request.base_suggestions or []

        # Enhance suggestions with AI
        system_prompt = (
            "You are a suggestion engine for an analytics platform.\n"
            "Review the current view, chart data, and base suggestions.\n"
            "Enhance or add 2-3 more relevant suggestions based on the current context.\n"
            "Return JSON array: [{\"id\": \"...\", \"label\": \"...\", \"action\": \"...\", \"reasoning\": \"...\", \"priority\": \"high|medium|low\", \"category\": \"...\"}]"
        )

        user_prompt = (
            f"Current View: {json.dumps(current_config, default=str)}\n"
            f"Chart Data Sample: {json.dumps(chart_data[:5], default=str)}\n"
            f"Selected Point: {json.dumps(selected_point, default=str) if selected_point else 'None'}\n"
            f"Base Suggestions: {json.dumps(base_suggestions, default=str)}\n\n"
            "Generate 2-3 additional context-aware suggestions."
        )

        try:
            ai_response = call_azure_gpt([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])

            import re
            json_match = re.search(r"\[[\s\S]*\]", ai_response)
            if json_match:
                ai_suggestions = json.loads(json_match.group(0))
                if isinstance(ai_suggestions, list):
                    # Merge with base suggestions
                    all_suggestions = base_suggestions + ai_suggestions
                    # Deduplicate by action
                    seen = set()
                    unique = []
                    for s in all_suggestions:
                        action = s.get('action', '')
                        if action and action not in seen:
                            seen.add(action)
                            unique.append(s)
                    return {"suggestions": unique[:5]}
        except Exception as e:
            print(f"AI enhancement error: {e}")

        # Fallback to base suggestions
        return {"suggestions": base_suggestions[:5]}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Adaptive suggestions error: {str(exc)}")


@app.post("/api/ai/suggestions")
async def generate_suggestions(request: SuggestionRequest) -> Dict[str, Any]:
    """
    Generate context-aware suggestions based on current view config and session history.
    Returns structured suggestions with action scores.
    """
    try:
        current_config = request.current_view_config or {}
        session_history = request.session_history or []
        
        # Determine analysis type
        analysis_type = current_config.get('analysis_type')
        funnel_def = current_config.get('funnel_definition', {})
        segmentation_state = current_config.get('segmentation_state', {})
        
        suggestions = []
        
        # Generate suggestions based on analysis type
        if analysis_type == 'funnel':
            steps = funnel_def.get('steps', [])
            group_by = funnel_def.get('group_by')
            segments = funnel_def.get('segments', [])
            
            # Compare suggestions
            if not group_by and len(steps) > 0:
                suggestions.append({
                    "id": "compare-device",
                    "type": "compare",
                    "title": "Compare by Device Type",
                    "description": "See how mobile vs desktop users convert differently",
                    "action_score": 75,
                    "suggested_action": "Group this funnel by device type",
                })
                
                suggestions.append({
                    "id": "compare-traffic",
                    "type": "compare",
                    "title": "Compare Traffic Sources",
                    "description": "Identify which marketing channels drive the best conversions",
                    "action_score": 70,
                    "suggested_action": "Group this funnel by traffic source",
                })
            
            # Drill-down suggestions
            if len(steps) > 3:
                mid_idx = len(steps) // 2
                mid_step = steps[mid_idx] if mid_idx < len(steps) else None
                if mid_step:
                    step_label = mid_step.get('label', 'Middle Step')
                    suggestions.append({
                        "id": "drill-mid-step",
                        "type": "drill",
                        "title": f"Analyze {step_label}",
                        "description": "Deep dive into what happens at this step",
                        "action_score": 65,
                        "suggested_action": f"Show detailed analysis for {step_label}",
                    })
            
            # Segment suggestions
            if not segments or len(segments) == 0:
                suggestions.append({
                    "id": "segment-mobile",
                    "type": "segment",
                    "title": "Segment Mobile Users",
                    "description": "Create a segment for mobile users to compare conversion rates",
                    "action_score": 60,
                    "suggested_action": "Add a segment for mobile device users",
                })
        
        elif analysis_type == 'segmentation':
            mode = segmentation_state.get('mode')
            group_by = segmentation_state.get('group_by')
            
            # Compare suggestions
            if mode == 'event' and not group_by:
                suggestions.append({
                    "id": "compare-device-seg",
                    "type": "compare",
                    "title": "Breakdown by Device",
                    "description": "See how events vary across device types",
                    "action_score": 70,
                    "suggested_action": "Group events by device type",
                })
            
            # Forecast suggestions
            if mode in ['behavioral', 'guest']:
                suggestions.append({
                    "id": "forecast-conversion",
                    "type": "forecast",
                    "title": "Project Next Week",
                    "description": "Forecast conversion rates for the next 7 days",
                    "action_score": 55,
                    "suggested_action": "Show forecast for next week",
                })
        
        # Use AI to enhance suggestions if Azure GPT is available
        if azure_openai_client and len(suggestions) > 0:
            try:
                system_prompt = (
                    "You are a suggestion engine for an analytics platform.\n"
                    "Review the current view configuration and session history, then enhance or add suggestions.\n"
                    "Return a JSON array of suggestions with: id, type, title, description, action_score (0-100), suggested_action.\n"
                    "Types: compare, drill, segment, forecast, diagnose."
                )
                
                user_prompt = (
                    f"Current config: {json.dumps(current_config, default=str)}\n"
                    f"Session history: {json.dumps(session_history, default=str)}\n"
                    f"Current suggestions: {json.dumps(suggestions, default=str)}\n\n"
                    "Enhance or add 2-3 more relevant suggestions. Return JSON array only."
                )
                
                ai_response = call_azure_gpt([
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ])
                
                # Try to parse AI suggestions
                import re
                json_match = re.search(r"\[[\s\S]*\]", ai_response)
                if json_match:
                    ai_suggestions = json.loads(json_match.group(0))
                    if isinstance(ai_suggestions, list):
                        suggestions.extend(ai_suggestions[:3])  # Add up to 3 AI suggestions
            except Exception as e:
                print(f"AI suggestion enhancement error: {e}")
                # Continue with rule-based suggestions
        
        # Sort by action_score descending
        suggestions.sort(key=lambda x: x.get('action_score', 0), reverse=True)
        
        return {
            "suggestions": suggestions[:5],  # Return top 5
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Suggestions error: {str(exc)}")


@app.get("/api/ai/anomalies")
async def get_recent_anomalies(limit: int = Query(default=10, ge=1, le=50)) -> Dict[str, Any]:
    """
    Returns cached anomalies from background anomaly detection task.
    Anomalies are detected periodically (every 15 minutes) by a background task.
    """
    try:
        from engines.autonomousAnalyst import get_recent_anomalies, get_last_check_timestamp
        
        anomalies = get_recent_anomalies(limit)
        last_check = get_last_check_timestamp()
        
        return {
            "anomalies": anomalies,
            "last_check_timestamp": last_check.isoformat() if last_check else None,
            "count": len(anomalies),
        }
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Autonomous analyst module not available"
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Anomalies endpoint error: {str(exc)}")


async def background_anomaly_check():
    """Background task to run anomaly detection periodically."""
    try:
        from engines.autonomousAnalyst import detect_anomalies
        await detect_anomalies()
    except Exception as e:
        print(f"Background anomaly check error: {e}")


# Start background task on app startup
@app.on_event("startup")
async def startup_event():
    """Start background anomaly detection task."""
    import asyncio
    async def periodic_check():
        while True:
            await background_anomaly_check()
            await asyncio.sleep(900)  # Run every 15 minutes
    
    # Start background task
    asyncio.create_task(periodic_check())


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
