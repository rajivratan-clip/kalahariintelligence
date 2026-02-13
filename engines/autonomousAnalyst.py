"""
Autonomous Analyst Service
Runs periodic background checks for anomalies (conversion drops, revenue deviations).
Stores anomalies in memory cache (later: database).
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from database import run_query
import json
import os

# In-memory cache for anomalies (later: database table)
_anomaly_cache: List[Dict] = []
_last_check_timestamp: Optional[datetime] = None


class Anomaly:
    """Represents a detected anomaly."""
    def __init__(
        self,
        anomaly_type: str,
        severity: str,
        description: str,
        detected_at: datetime,
        metric_value: Optional[float] = None,
        baseline_value: Optional[float] = None,
        metadata: Optional[Dict] = None
    ):
        self.anomaly_type = anomaly_type  # 'conversion_drop' | 'revenue_deviation' | 'visitor_drop'
        self.severity = severity  # 'low' | 'medium' | 'high'
        self.description = description
        self.detected_at = detected_at
        self.metric_value = metric_value
        self.baseline_value = baseline_value
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict:
        return {
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "description": self.description,
            "detected_at": self.detected_at.isoformat(),
            "metric_value": self.metric_value,
            "baseline_value": self.baseline_value,
            "metadata": self.metadata,
        }


async def detect_anomalies() -> List[Anomaly]:
    """
    Run periodic checks for anomalies:
    - Conversion drops > threshold
    - Revenue deviations
    - Visitor volume drops
    
    Returns list of detected anomalies.
    """
    anomalies: List[Anomaly] = []
    now = datetime.now()
    
    # Check conversion drops (compare last 24h vs last 30 days average)
    try:
        conversion_query = """
            WITH last_24h AS (
                SELECT 
                    funnel_step,
                    count(DISTINCT session_id) as sessions,
                    count(DISTINCT CASE WHEN funnel_step = 6 THEN session_id END) as conversions
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL 24 HOUR
                GROUP BY funnel_step
            ),
            last_30d AS (
                SELECT 
                    funnel_step,
                    count(DISTINCT session_id) as sessions,
                    count(DISTINCT CASE WHEN funnel_step = 6 THEN session_id END) as conversions
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL 30 DAY
                GROUP BY funnel_step
            )
            SELECT 
                l24.funnel_step,
                l24.sessions as current_sessions,
                l24.conversions as current_conversions,
                l30.sessions as baseline_sessions,
                l30.conversions as baseline_conversions,
                CASE 
                    WHEN l30.sessions > 0 THEN (l24.sessions::Float / l30.sessions::Float - 1) * 100
                    ELSE 0
                END as session_delta_pct,
                CASE 
                    WHEN l30.conversions > 0 AND l30.sessions > 0 THEN (l30.conversions::Float / l30.sessions::Float) * 100
                    ELSE 0
                END as baseline_conversion_rate,
                CASE 
                    WHEN l24.conversions > 0 AND l24.sessions > 0 THEN (l24.conversions::Float / l24.sessions::Float) * 100
                    ELSE 0
                END as current_conversion_rate
            FROM last_24h l24
            JOIN last_30d l30 ON l24.funnel_step = l30.funnel_step
            WHERE l30.sessions > 100  -- Only check steps with sufficient baseline data
            ORDER BY l24.funnel_step
        """
        
        rows = run_query(conversion_query)
        for row in rows:
            funnel_step = row[0]
            current_sessions = row[1]
            current_conversions = row[2]
            baseline_sessions = row[3]
            baseline_conversions = row[4]
            session_delta_pct = row[5]
            baseline_conversion_rate = row[6]
            current_conversion_rate = row[7]
            
            # Check conversion rate drop
            if baseline_conversion_rate > 0:
                conversion_delta = current_conversion_rate - baseline_conversion_rate
                conversion_delta_pct = (conversion_delta / baseline_conversion_rate) * 100
                
                if conversion_delta_pct <= -15:  # 15% drop threshold
                    severity = 'high' if conversion_delta_pct <= -30 else 'medium' if conversion_delta_pct <= -20 else 'low'
                    anomalies.append(Anomaly(
                        anomaly_type='conversion_drop',
                        severity=severity,
                        description=f"Conversion rate at funnel step {funnel_step} dropped {abs(conversion_delta_pct):.1f}% "
                                   f"({current_conversion_rate:.1f}% vs {baseline_conversion_rate:.1f}% baseline)",
                        detected_at=now,
                        metric_value=current_conversion_rate,
                        baseline_value=baseline_conversion_rate,
                        metadata={
                            "funnel_step": funnel_step,
                            "current_sessions": current_sessions,
                            "current_conversions": current_conversions,
                        }
                    ))
            
            # Check visitor volume drop
            if session_delta_pct <= -20:  # 20% drop threshold
                severity = 'high' if session_delta_pct <= -40 else 'medium'
                anomalies.append(Anomaly(
                    anomaly_type='visitor_drop',
                    severity=severity,
                    description=f"Visitor volume at funnel step {funnel_step} dropped {abs(session_delta_pct):.1f}% "
                               f"({current_sessions} vs {baseline_sessions} baseline)",
                    detected_at=now,
                    metric_value=current_sessions,
                    baseline_value=baseline_sessions,
                    metadata={"funnel_step": funnel_step}
                ))
    
    except Exception as e:
        print(f"Error detecting conversion anomalies: {e}")
    
    # Check revenue deviations
    try:
        revenue_query = """
            WITH last_24h AS (
                SELECT 
                    sum(price_viewed_amount) as revenue
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL 24 HOUR
                  AND price_viewed_amount > 0
            ),
            last_30d AS (
                SELECT 
                    sum(price_viewed_amount) / 30.0 as avg_daily_revenue
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL 30 DAY
                  AND price_viewed_amount > 0
            )
            SELECT 
                l24.revenue as current_revenue,
                l30.avg_daily_revenue as baseline_revenue,
                CASE 
                    WHEN l30.avg_daily_revenue > 0 THEN ((l24.revenue::Float / l30.avg_daily_revenue::Float) - 1) * 100
                    ELSE 0
                END as revenue_delta_pct
            FROM last_24h l24, last_30d l30
        """
        
        rows = run_query(revenue_query)
        if rows and len(rows) > 0:
            row = rows[0]
            current_revenue = row[0] or 0
            baseline_revenue = row[1] or 0
            revenue_delta_pct = row[2] or 0
            
            if baseline_revenue > 0:
                # Flag significant deviations (>30% drop or >50% increase)
                if revenue_delta_pct <= -30:
                    severity = 'high' if revenue_delta_pct <= -50 else 'medium'
                    anomalies.append(Anomaly(
                        anomaly_type='revenue_deviation',
                        severity=severity,
                        description=f"Revenue dropped {abs(revenue_delta_pct):.1f}% "
                                   f"(${current_revenue:.2f} vs ${baseline_revenue:.2f} daily average)",
                        detected_at=now,
                        metric_value=current_revenue,
                        baseline_value=baseline_revenue,
                        metadata={"revenue_delta_pct": revenue_delta_pct}
                    ))
                elif revenue_delta_pct >= 50:
                    # Large increase might indicate data quality issue
                    anomalies.append(Anomaly(
                        anomaly_type='revenue_deviation',
                        severity='medium',
                        description=f"Revenue increased {revenue_delta_pct:.1f}% "
                                   f"(${current_revenue:.2f} vs ${baseline_revenue:.2f} daily average). "
                                   "This may indicate a data quality issue.",
                        detected_at=now,
                        metric_value=current_revenue,
                        baseline_value=baseline_revenue,
                        metadata={"revenue_delta_pct": revenue_delta_pct}
                    ))
    
    except Exception as e:
        print(f"Error detecting revenue anomalies: {e}")
    
    # Update cache (keep last 50 anomalies)
    global _anomaly_cache, _last_check_timestamp
    _anomaly_cache = [a.to_dict() for a in anomalies][:50]
    _last_check_timestamp = now
    
    return anomalies


async def analyze_root_cause(anomaly: Anomaly) -> Dict[str, Any]:
    """
    Analyze root cause of an anomaly by segmenting by device, geo, traffic_source.
    Uses Azure GPT for causal analysis.
    """
    try:
        # Try to import Azure GPT client
        from openai import AzureOpenAI
        
        azure_endpoint = os.getenv(
            "AZURE_OPENAI_ENDPOINT",
            "https://ai-engineering5524ai609414313484.cognitiveservices.azure.com/",
        )
        azure_key = os.getenv("AZURE_OPENAI_API_KEY")
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        
        if not azure_key:
            return {
                "root_cause": "Unable to analyze root cause (AI not configured)",
                "segments": [],
            }
        
        client = AzureOpenAI(
            api_version=api_version,
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
        )
        
        # Get segment breakdown for the anomaly
        segments = []
        if anomaly.metadata and "funnel_step" in anomaly.metadata:
            funnel_step = anomaly.metadata["funnel_step"]
            try:
                segment_query = f"""
                    SELECT 
                        device_type,
                        count(DISTINCT session_id) as sessions,
                        count(DISTINCT CASE WHEN funnel_step = 6 THEN session_id END) as conversions
                    FROM raw_events
                    WHERE timestamp >= now() - INTERVAL 24 HOUR
                      AND funnel_step = {funnel_step}
                    GROUP BY device_type
                """
                segment_rows = run_query(segment_query)
                for row in segment_rows:
                    segments.append({
                        "dimension": "device_type",
                        "value": row[0] or "unknown",
                        "sessions": row[1],
                        "conversions": row[2],
                    })
            except Exception as e:
                print(f"Error fetching segments: {e}")
        
        system_prompt = (
            "You are a data analyst for a hospitality booking platform.\n"
            "Analyze the root cause of an anomaly based on segment breakdown data.\n"
            "Return a JSON object with: root_cause (string), likely_factors (array), recommendations (array)."
        )
        
        user_prompt = (
            f"Anomaly: {anomaly.description}\n"
            f"Type: {anomaly.anomaly_type}, Severity: {anomaly.severity}\n"
            f"Segment breakdown: {json.dumps(segments)}\n\n"
            "Analyze the root cause and return JSON."
        )
        
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=500,
        )
        
        content = response.choices[0].message.content
        if content:
            import re
            json_match = re.search(r"\{[\s\S]*\}", content)
            if json_match:
                return json.loads(json_match.group(0))
        
        return {
            "root_cause": "Analysis incomplete",
            "segments": segments,
        }
        
    except ImportError:
        return {
            "root_cause": "AI analysis unavailable (OpenAI package not installed)",
            "segments": [],
        }
    except Exception as e:
        print(f"Root cause analysis error: {e}")
        return {
            "root_cause": f"Analysis error: {str(e)}",
            "segments": [],
        }


def get_recent_anomalies(limit: int = 10) -> List[Dict]:
    """Get recent anomalies from cache."""
    return _anomaly_cache[:limit]


def get_last_check_timestamp() -> Optional[datetime]:
    """Get timestamp of last anomaly check."""
    return _last_check_timestamp
