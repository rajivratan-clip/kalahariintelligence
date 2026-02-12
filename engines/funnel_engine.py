"""
Hybrid Funnel Engine - Definition, Query Builder, Validation Layers

PHASE 3: Refactored logic engine
- Funnel Definition Layer: Resolve steps from mode (demo/dynamic)
- Query Builder Layer: Build ClickHouse SQL from funnel definition
- Validation Layer: Step ordering, count sanity, anomaly detection

Does NOT replace api.py funnel logic - provides shared utilities.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FunnelDefinition:
    """Resolved funnel definition - used by query builder."""
    funnel_id: str
    mode: str  # "demo" | "dynamic"
    steps: List[Dict[str, Any]]
    filters: Optional[Dict[str, Any]] = None
    segments: Optional[List[Dict]] = None


def resolve_funnel_steps(
    mode: str,
    steps: Optional[List[Dict]] = None,
    funnel_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Resolve funnel steps based on mode.
    
    - demo: Use predefined steps from config if steps empty, else use provided
    - dynamic: Use provided steps (must come from /api/funnel/events/dynamic)
    
    Returns list of step dicts compatible with FunnelStepRequest.
    """
    if mode == "dynamic":
        if not steps or len(steps) == 0:
            logger.warning("[FunnelEngine] Dynamic mode with no steps - returning empty")
            return []
        return steps

    # Demo mode
    if not steps or len(steps) == 0:
        try:
            from config.funnel_config import get_demo_funnel, get_default_demo_steps, to_funnel_step_request
            funnel = get_demo_funnel(funnel_id or "hospitality_booking")
            if funnel and funnel.get("steps"):
                return [to_funnel_step_request(s) for s in funnel["steps"]]
            return [to_funnel_step_request(s) for s in get_default_demo_steps()]
        except ImportError:
            logger.warning("[FunnelEngine] Config not found, using empty steps")
            return []
    return steps


def validate_funnel_results(
    step_counts: Dict[int, float],
    total_sessions_in_range: Optional[int] = None,
    step_count: int = 0
) -> Tuple[bool, List[str]]:
    """
    Validate funnel aggregation results.
    
    - Step N count <= Step N-1 count (windowFunnel guarantees this, but verify)
    - Step 1 <= total sessions in range
    - No negative drop-offs
    
    Returns (is_valid, list of anomaly messages)
    """
    anomalies: List[str] = []
    
    if not step_counts or step_count == 0:
        return True, []
    
    # Check step ordering: each step should have count <= previous
    prev_count = float("inf")
    for step_idx in range(1, step_count + 1):
        curr = step_counts.get(step_idx, 0) or 0
        if curr > prev_count:
            anomalies.append(f"Step {step_idx} count ({curr}) > Step {step_idx-1} ({prev_count}) - aggregation drift")
        prev_count = curr
    
    # Step 1 vs total sessions
    if total_sessions_in_range is not None and step_counts.get(1):
        step1 = step_counts[1]
        if step1 > total_sessions_in_range:
            anomalies.append(f"Step 1 sessions ({step1}) > total sessions in range ({total_sessions_in_range})")
    
    is_valid = len(anomalies) == 0
    if anomalies:
        logger.warning(f"[FunnelEngine] Validation anomalies: {anomalies}")
    
    return is_valid, anomalies


def build_metadata_for_ai(
    funnel_def: FunnelDefinition,
    step_counts: List[int],
    conversion_rates: List[float],
    drop_off_pcts: List[float],
    segments: Optional[Dict] = None,
    validation_anomalies: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Build structured data for AI insight layer (Phase 7).
    
    AI must NOT hallucinate numbers - this provides the exact data.
    """
    steps_summary = []
    for i, step in enumerate(funnel_def.steps):
        steps_summary.append({
            "step_num": i + 1,
            "label": step.get("label", step.get("event_type", f"Step {i+1}")),
            "event_type": step.get("event_type"),
            "visitors": step_counts[i] if i < len(step_counts) else 0,
            "conversion_rate_pct": conversion_rates[i] if i < len(conversion_rates) else 0,
            "drop_off_pct": drop_off_pcts[i] if i < len(drop_off_pcts) else 0,
        })
    
    # Find largest drop-off
    max_drop_idx = 0
    max_drop_val = 0
    for i, d in enumerate(drop_off_pcts):
        if d > max_drop_val and i > 0:
            max_drop_val = d
            max_drop_idx = i
    
    return {
        "funnel_name": funnel_def.funnel_id,
        "mode": funnel_def.mode,
        "steps": steps_summary,
        "step_counts": step_counts,
        "conversion_rates": conversion_rates,
        "drop_off_percentages": drop_off_pcts,
        "largest_drop_off": {
            "step_index": max_drop_idx + 1,
            "step_label": steps_summary[max_drop_idx]["label"] if max_drop_idx < len(steps_summary) else "",
            "drop_off_pct": max_drop_val,
        },
        "segments": segments or {},
        "validation_anomalies": validation_anomalies or [],
        "behavior_flags": {
            "has_segments": bool(segments and len(segments) > 0),
            "has_anomalies": bool(validation_anomalies and len(validation_anomalies) > 0),
        },
    }
