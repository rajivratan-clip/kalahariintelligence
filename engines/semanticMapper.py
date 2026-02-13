"""
Semantic Mapper Service
Auto-maps raw event names to business-friendly labels using Azure GPT.
"""

from typing import Dict, List, Optional
import json
import os

# In-memory cache for semantic mappings (later: database table)
_semantic_cache: Dict[str, Dict] = {}


async def map_event_to_business(
    event_type: str,
    context: Optional[Dict] = None
) -> Dict[str, any]:
    """
    Map a raw event name to a business-friendly label.
    
    Args:
        event_type: Raw event type name (e.g., "page_view", "room_select")
        context: Optional context dict with event frequency, page_url patterns, etc.
    
    Returns:
        {
            "business_label": str,  # e.g., "Page Viewed", "Room Selection"
            "confidence": str,  # "high" | "medium" | "low"
            "category": str,  # e.g., "navigation", "booking", "engagement"
        }
    """
    # Check cache first
    if event_type in _semantic_cache:
        return _semantic_cache[event_type]
    
    # Try to import Azure GPT client
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
            # Fallback to rule-based mapping
            return _rule_based_mapping(event_type)
        
        client = AzureOpenAI(
            api_version=api_version,
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
        )
        
        # Build context string
        context_str = ""
        if context:
            if "event_frequency" in context:
                context_str += f"Event occurs {context['event_frequency']} times. "
            if "page_url_patterns" in context:
                context_str += f"Common pages: {', '.join(context['page_url_patterns'][:3])}. "
        
        system_prompt = (
            "You are a semantic mapping assistant for a hospitality analytics platform.\n"
            "Your job is to map raw technical event names to business-friendly labels.\n\n"
            "Examples:\n"
            "- 'page_view' → business_label: 'Page Viewed', category: 'navigation', confidence: 'high'\n"
            "- 'room_select' → business_label: 'Room Selection', category: 'booking', confidence: 'high'\n"
            "- 'form_submit' → business_label: 'Form Submitted', category: 'engagement', confidence: 'high'\n\n"
            "Return ONLY a JSON object with: business_label, confidence (high/medium/low), category.\n"
            "Categories: navigation, booking, engagement, interaction, error, marketing, performance"
        )
        
        user_prompt = (
            f"Map this event type to a business label: '{event_type}'\n"
            f"{context_str}\n"
            "Return JSON: {\"business_label\": \"...\", \"confidence\": \"high|medium|low\", \"category\": \"...\"}"
        )
        
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=200,
        )
        
        content = response.choices[0].message.content
        if content:
            # Try to extract JSON from response
            try:
                # Look for JSON block
                import re
                json_match = re.search(r"\{[\s\S]*\}", content)
                if json_match:
                    result = json.loads(json_match.group(0))
                    mapping = {
                        "business_label": result.get("business_label", event_type),
                        "confidence": result.get("confidence", "medium"),
                        "category": result.get("category", "unknown"),
                    }
                    # Cache the result
                    _semantic_cache[event_type] = mapping
                    return mapping
            except Exception:
                pass
        
        # Fallback to rule-based if GPT fails
        return _rule_based_mapping(event_type)
        
    except ImportError:
        # OpenAI not available, use rule-based
        return _rule_based_mapping(event_type)
    except Exception as e:
        print(f"Semantic mapping error for {event_type}: {e}")
        return _rule_based_mapping(event_type)


async def batch_map_events(event_types: List[str]) -> Dict[str, Dict]:
    """
    Batch process multiple event types for efficiency.
    
    Args:
        event_types: List of event type names
    
    Returns:
        Dict mapping event_type -> mapping result
    """
    results = {}
    for event_type in event_types:
        results[event_type] = await map_event_to_business(event_type)
    return results


def _rule_based_mapping(event_type: str) -> Dict[str, any]:
    """
    Fallback rule-based mapping when AI is unavailable.
    """
    # Common mappings
    mappings = {
        "page_view": {"business_label": "Page Viewed", "confidence": "high", "category": "navigation"},
        "click": {"business_label": "Click", "confidence": "high", "category": "interaction"},
        "form_submit": {"business_label": "Form Submitted", "confidence": "high", "category": "engagement"},
        "form_interaction": {"business_label": "Form Interaction", "confidence": "high", "category": "engagement"},
        "scroll": {"business_label": "Scroll", "confidence": "high", "category": "engagement"},
        "error": {"business_label": "Error", "confidence": "high", "category": "error"},
        "landed": {"business_label": "Landed", "confidence": "high", "category": "navigation"},
        "location_select": {"business_label": "Location Selected", "confidence": "high", "category": "booking"},
        "date_select": {"business_label": "Date Selected", "confidence": "high", "category": "booking"},
        "room_select": {"business_label": "Room Selected", "confidence": "high", "category": "booking"},
        "payment": {"business_label": "Payment", "confidence": "high", "category": "booking"},
        "confirmation": {"business_label": "Confirmation", "confidence": "high", "category": "booking"},
    }
    
    # Try exact match first
    if event_type.lower() in mappings:
        return mappings[event_type.lower()]
    
    # Try partial matching
    event_lower = event_type.lower()
    for key, value in mappings.items():
        if key in event_lower or event_lower in key:
            return value
    
    # Default fallback
    return {
        "business_label": event_type.replace("_", " ").title(),
        "confidence": "low",
        "category": "unknown",
    }
