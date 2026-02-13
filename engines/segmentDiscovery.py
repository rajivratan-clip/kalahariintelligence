"""
Segment Discovery Agent
Auto-discovers high-value segments using clustering algorithms (RFM + behavioral).
Uses Azure GPT to name segments.
"""

from typing import List, Dict, Optional, Any
from database import run_query
import json
import os


async def discover_segments(
    time_period_days: int = 30,
    min_sessions: int = 100
) -> List[Dict[str, Any]]:
    """
    Discover high-value segments using RFM (Recency, Frequency, Monetary) + behavioral clustering.
    
    Args:
        time_period_days: Time period to analyze (default: 30)
        min_sessions: Minimum sessions required for a segment (default: 100)
    
    Returns:
        List of discovered segments with metrics
    """
    try:
        # RFM Analysis Query
        rfm_query = f"""
            WITH user_metrics AS (
                SELECT 
                    user_id,
                    count(DISTINCT session_id) as frequency,
                    max(timestamp) as last_visit,
                    sum(price_viewed_amount) as monetary_value,
                    count(DISTINCT CASE WHEN funnel_step = 6 THEN session_id END) as conversions,
                    max(funnel_step) as max_funnel_depth,
                    avg(time_on_page_seconds) as avg_time_on_page
                FROM raw_events
                WHERE timestamp >= now() - INTERVAL {time_period_days} DAY
                  AND user_id != ''
                GROUP BY user_id
            ),
            rfm_scores AS (
                SELECT 
                    user_id,
                    frequency,
                    dateDiff('day', last_visit, now()) as recency_days,
                    monetary_value,
                    conversions,
                    max_funnel_depth,
                    avg_time_on_page,
                    -- RFM Scoring
                    CASE 
                        WHEN recency_days <= 7 THEN 5
                        WHEN recency_days <= 14 THEN 4
                        WHEN recency_days <= 30 THEN 3
                        WHEN recency_days <= 60 THEN 2
                        ELSE 1
                    END as recency_score,
                    CASE 
                        WHEN frequency >= 10 THEN 5
                        WHEN frequency >= 5 THEN 4
                        WHEN frequency >= 3 THEN 3
                        WHEN frequency >= 2 THEN 2
                        ELSE 1
                    END as frequency_score,
                    CASE 
                        WHEN monetary_value >= 1000 THEN 5
                        WHEN monetary_value >= 500 THEN 4
                        WHEN monetary_value >= 200 THEN 3
                        WHEN monetary_value >= 50 THEN 2
                        ELSE 1
                    END as monetary_score
                FROM user_metrics
            )
            SELECT 
                recency_score,
                frequency_score,
                monetary_score,
                count(*) as user_count,
                avg(conversions) as avg_conversions,
                avg(max_funnel_depth) as avg_funnel_depth,
                avg(avg_time_on_page) as avg_time_on_page
            FROM rfm_scores
            GROUP BY recency_score, frequency_score, monetary_score
            HAVING user_count >= {min_sessions}
            ORDER BY (recency_score + frequency_score + monetary_score) DESC, user_count DESC
            LIMIT 10
        """
        
        rows = run_query(rfm_query)
        segments = []
        
        for row in rows:
            recency_score = row[0]
            frequency_score = row[1]
            monetary_score = row[2]
            user_count = row[3]
            avg_conversions = row[4] or 0
            avg_funnel_depth = row[5] or 0
            avg_time_on_page = row[6] or 0
            
            # Generate segment name using Azure GPT
            segment_name = await generate_segment_name(
                recency_score, frequency_score, monetary_score,
                user_count, avg_conversions, avg_funnel_depth
            )
            
            segments.append({
                "name": segment_name,
                "rfm_scores": {
                    "recency": recency_score,
                    "frequency": frequency_score,
                    "monetary": monetary_score,
                },
                "metrics": {
                    "user_count": user_count,
                    "avg_conversions": float(avg_conversions),
                    "avg_funnel_depth": float(avg_funnel_depth),
                    "avg_time_on_page": float(avg_time_on_page),
                },
                "segment_type": "discovered",
            })
        
        return segments
        
    except Exception as e:
        print(f"Error discovering segments: {e}")
        return []


async def generate_segment_name(
    recency_score: int,
    frequency_score: int,
    monetary_score: int,
    user_count: int,
    avg_conversions: float,
    avg_funnel_depth: float
) -> str:
    """
    Use Azure GPT to generate a meaningful segment name based on RFM scores.
    """
    try:
        from openai import AzureOpenAI
        
        azure_endpoint = os.getenv(
            "AZURE_OPENAI_ENDPOINT",
            "https://ai-engineering5524ai609414313484.cognitiveservices.azure.com/",
        )
        azure_key = os.getenv("AZURE_OPENAI_API_KEY")
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        
        if not azure_key:
            # Fallback to rule-based naming
            return _rule_based_segment_name(recency_score, frequency_score, monetary_score)
        
        client = AzureOpenAI(
            api_version=api_version,
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
        )
        
        system_prompt = (
            "You are a segment naming assistant for a hospitality analytics platform.\n"
            "Generate a concise, business-friendly segment name (2-4 words) based on RFM scores.\n"
            "Return ONLY the segment name, no additional text."
        )
        
        user_prompt = (
            f"RFM Scores: Recency={recency_score}/5, Frequency={frequency_score}/5, Monetary={monetary_score}/5\n"
            f"Users: {user_count}, Avg Conversions: {avg_conversions:.2f}, Avg Funnel Depth: {avg_funnel_depth:.1f}\n"
            "Generate a segment name (e.g., 'VIP Guests', 'High-Value Visitors', 'At-Risk Customers')."
        )
        
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=50,
        )
        
        name = response.choices[0].message.content.strip()
        # Remove quotes if present
        name = name.strip('"').strip("'")
        return name or _rule_based_segment_name(recency_score, frequency_score, monetary_score)
        
    except ImportError:
        return _rule_based_segment_name(recency_score, frequency_score, monetary_score)
    except Exception as e:
        print(f"Error generating segment name: {e}")
        return _rule_based_segment_name(recency_score, frequency_score, monetary_score)


def _rule_based_segment_name(r: int, f: int, m: int) -> str:
    """Fallback rule-based segment naming."""
    total_score = r + f + m
    
    if total_score >= 13:
        return "VIP Guests"
    elif total_score >= 10:
        return "High-Value Visitors"
    elif total_score >= 7:
        return "Regular Guests"
    elif r >= 4 and f >= 3:
        return "Engaged Visitors"
    elif m >= 4:
        return "High-Spenders"
    elif r <= 2:
        return "At-Risk Customers"
    else:
        return f"RFM-{r}{f}{m}"
