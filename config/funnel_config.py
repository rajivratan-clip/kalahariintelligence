"""
Funnel Configuration Module - Centralized funnel definitions

PHASE 2: Hybrid Funnel Architecture
- Mode 1 (Demo): Curated, stable steps for demos
- Mode 2 (Dynamic): User builds from any event_type in DB

This module defines DEMO mode funnels only. Dynamic mode fetches from DB.
"""

from typing import List, Dict, Any, Optional

# Demo funnel step config - maps to EVENT_MAPPING / funnel_step in api.py
DEMO_FUNNEL_ID = "hospitality_booking"
DEMO_FUNNEL_LABEL = "Hospitality Booking Funnel"

# Curated demo steps - stable for investor/client demos
# These use hospitality funnel_step (1-8) or mapped generic event_type
DEMO_FUNNEL_STEPS: List[Dict[str, Any]] = [
    {"id": "1", "label": "Landed", "event_category": "hospitality", "event_type": "Landed", "order": 1},
    {"id": "2", "label": "Location Select", "event_category": "hospitality", "event_type": "Location Select", "order": 2},
    {"id": "3", "label": "Date Select", "event_category": "hospitality", "event_type": "Date Select", "order": 3},
    {"id": "4", "label": "Room Select", "event_category": "hospitality", "event_type": "Room Select", "order": 4},
    {"id": "5", "label": "Payment", "event_category": "hospitality", "event_type": "Payment", "order": 5},
    {"id": "6", "label": "Confirmation", "event_category": "hospitality", "event_type": "Confirmation", "order": 6},
]

# Alternative demo: "Viewed Room" style (matches prompt naming)
DEMO_FUNNEL_ALTERNATE: List[Dict[str, Any]] = [
    {"id": "1", "label": "Viewed Room", "event_category": "hospitality", "event_type": "Room Select", "order": 1},
    {"id": "2", "label": "Selected Dates", "event_category": "hospitality", "event_type": "Date Select", "order": 2},
    {"id": "3", "label": "Add-on Select", "event_category": "hospitality", "event_type": "Add-on Select", "order": 3},
    {"id": "4", "label": "Initiated Checkout", "event_category": "hospitality", "event_type": "Payment", "order": 4},
    {"id": "5", "label": "Completed Booking", "event_category": "hospitality", "event_type": "Confirmation", "order": 5},
]

# Mapping: funnel_id -> steps (for future multi-funnel support)
DEMO_FUNNELS: Dict[str, Dict[str, Any]] = {
    DEMO_FUNNEL_ID: {
        "id": DEMO_FUNNEL_ID,
        "label": DEMO_FUNNEL_LABEL,
        "mode": "demo",
        "steps": DEMO_FUNNEL_STEPS,
    },
    "hospitality_booking_alt": {
        "id": "hospitality_booking_alt",
        "label": "Booking Journey (Alternate)",
        "mode": "demo",
        "steps": DEMO_FUNNEL_ALTERNATE,
    },
}


def get_demo_funnel(funnel_id: str = DEMO_FUNNEL_ID) -> Optional[Dict[str, Any]]:
    """Return demo funnel definition by id."""
    return DEMO_FUNNELS.get(funnel_id)


def get_default_demo_steps() -> List[Dict[str, Any]]:
    """Return default demo steps (main hospitality funnel)."""
    return DEMO_FUNNEL_STEPS.copy()


def to_funnel_step_request(step: Dict[str, Any]) -> Dict[str, Any]:
    """Convert config step to FunnelStepRequest-compatible dict."""
    return {
        "event_category": step.get("event_category", "hospitality"),
        "event_type": step["event_type"],
        "label": step.get("label", step["event_type"]),
        "filters": step.get("filters", []),
    }
