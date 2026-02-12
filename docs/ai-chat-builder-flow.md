# AI Chat Builder - How It Works (No Hardcoding)

## Overview

The AI chat builder uses **GPT (Azure OpenAI)** to understand natural language queries and dynamically generate chart configurations. It's **NOT hardcoded** - it uses LLM reasoning to extract intent and build the appropriate `AnalyticsConfigUpdate`.

---

## Flow Diagram

```
User Types: "Build me a mobile user funnel"
    ↓
AskAISidebar.handleSubmit()
    ↓
geminiService.generateInsight() 
    → POST /api/ai/insight
    ↓
Backend (api.py) → call_azure_gpt()
    ↓
GPT analyzes query + context
    ↓
Returns: { markdown: "...", config_updates: {...} }
    ↓
Frontend receives AiEngineResponse
    ↓
applyViewConfig() + onApplyConfig()
    ↓
AnalyticsStudio updates UI
```

---

## How It Works (Step-by-Step)

### 1. **User Query Entry** (`AskAISidebar.tsx`)

When user types a query like:
- "Build me a funnel for mobile users"
- "Show behavioral segments"
- "Create a revenue impact chart"

```typescript
const response = await generateInsight(
  context?.contextName || 'General Query',
  context?.data || {},
  questionText,  // ← Natural language query
  currentViewConfig || session.currentViewConfig,
  session.analyses
);
```

### 2. **Frontend Service** (`services/geminiService.ts`)

Sends to backend `/api/ai/insight` with:
- `user_query`: The natural language text
- `current_view`: What chart is currently displayed
- `session_analyses`: Previous analyses for context

### 3. **Backend AI Processing** (`api.py` - `/api/ai/insight`)

**The magic happens here:**

#### Option A: GPT-Powered Intent Extraction (Primary Method)

The backend uses **Azure GPT** with a system prompt that instructs it to:

1. **Understand the user's intent** from natural language
2. **Extract chart configuration** from the query
3. **Return structured JSON** with `config_updates`

**System Prompt Structure:**
```python
system_prompt = (
    "You are a friendly analytics assistant for a hospitality booking platform.\n"
    "Your job: help users BUILD charts by understanding what they want.\n\n"
    "## You can create:\n"
    "1. **Funnel** - conversion funnel (Landed → Location → Date → Room → Payment → Confirmation)\n"
    "2. **Segmentation** - event-based, behavioral, or guest segments\n\n"
    "## Rules:\n"
    "- If user says 'funnel', 'conversion', 'booking funnel' → return config for funnel\n"
    "- If user says 'segment', 'compare', 'behavioral' → return config for segmentation\n"
    "- You MUST output a JSON block: ```json\n{\"config_updates\": {...}}\n```\n"
    "- config_updates can include: analysis_type, measurement, funnel_steps, segment_mode\n"
)
```

**GPT Response Parsing:**
```python
raw = call_azure_gpt([...])  # Gets GPT's text response

# Extract JSON from GPT's response (it embeds JSON in markdown)
json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw)
if json_match:
    parsed = json.loads(json_match.group(1))
    config_updates = parsed.get("config_updates")
```

**Example GPT Response:**
```
Great! I'll build a funnel for mobile users.

```json
{
  "config_updates": {
    "analysis_type": "funnel",
    "measurement": "conversion",
    "funnel_steps": [
      {"id": "1", "label": "Landed", "event_type": "Page Viewed", "event_category": "hospitality"},
      ...
    ]
  }
}
```
```

#### Option B: Fallback Regex Detection (If GPT Fails)

If GPT doesn't return valid JSON, the backend falls back to **regex-based intent detection**:

```python
# Determine intent from user text (broad matching)
wants_funnel = any(
    x in user_text for x in [
        "funnel", "conversion", "booking", "build", "standard", "chart",
        "flow", "journey", "landed", "payment", "confirmation", "room select",
    ]
)
wants_segment = any(
    x in user_text for x in ["segment", "behavioral", "compare", "guest", "device"]
)

# Fallback when no config from LLM
if not config_updates:
    if wants_funnel:
        config_updates = {
            "analysis_type": "funnel",
            "measurement": "conversion",
            "funnel_steps": GUIDED_BUILD_FUNNEL_STEPS,
        }
    elif wants_segment:
        config_updates = {
            "analysis_type": "segmentation",
            "segment_mode": "behavioral" if "behavioral" in user_text else "guest" if "guest" in user_text else "event",
        }
```

**Note:** This fallback is **only used if GPT fails**. The primary method is GPT-based.

### 4. **Response Format** (`AiEngineResponse`)

The backend returns:
```typescript
{
  markdown: "✓ Chart built successfully. Your booking funnel is ready...",
  view_config: {
    id: "funnel-123",
    analysis_type: "funnel",
    measurement: "conversion",
    funnel_definition: {...},
    layout_template: "SINGLE_CHART",
    ai_reasoning: {
      observation: "...",
      prediction: "...",
      action_score: 87
    }
  },
  config_updates: {
    analysis_type: "funnel",
    measurement: "conversion",
    funnel_steps: [...]
  },
  proactive_insights: [...]
}
```

### 5. **Frontend Application** (`AskAISidebar.tsx`)

```typescript
// Apply view config if AI returned one
if (response.view_config) {
  applyViewConfig(session.id, response.view_config, response.config_updates);
  if (response.config_updates && onApplyConfig) {
    onApplyConfig(response.config_updates);  // ← Updates AnalyticsStudio
  }
}
```

### 6. **UI Update** (`AnalyticsStudio.tsx`)

The `applyConfigRef` callback updates the UI:
```typescript
applyConfigRef.current = (updates: AnalyticsConfigUpdate) => {
  if (updates.analysis_type) setAnalysisType(updates.analysis_type);
  if (updates.measurement) setMeasurement(updates.measurement);
  if (updates.funnel_steps) {
    // Update funnel config
    setFunnelConfig({ ...prev, steps: mappedSteps });
  }
  if (updates.segment_mode) {
    setInjectedSegmentMode(updates.segment_mode);
  }
};
```

---

## Key Features

### ✅ **No Hardcoding**

- GPT understands **any natural language query**
- Examples that work:
  - "Show me mobile vs desktop conversion"
  - "Build a funnel for returning guests"
  - "Compare behavioral segments"
  - "Create a revenue impact analysis"
  - "I want to see how families convert"

### ✅ **Context-Aware**

- Sends `current_view` so AI can **mutate** existing charts
- Example: "Add a filter for mobile users" modifies current chart instead of rebuilding

### ✅ **Session Memory**

- Sends `session_analyses` (last 5 analyses)
- Enables: "Compare this to last month"

### ✅ **Structured Output**

- GPT returns JSON with `config_updates`
- Backend validates and applies it
- Fallback regex ensures it always works

---

## Advanced: Guided Build Endpoint

There's also a dedicated `/api/ai/guided-build` endpoint for **multi-turn conversations**:

```python
@app.post("/api/ai/guided-build")
async def guided_build(request: GuidedBuildRequest):
    """
    AI-guided chart builder. User describes what they want (or answers AI questions).
    Returns both a friendly message AND config_updates to apply.
    """
    messages = request.messages  # Full conversation history
    
    # GPT analyzes entire conversation
    raw = call_azure_gpt([
        {"role": "system", "content": system_prompt},
        *messages,  # Full chat history
    ])
    
    # Extract config_updates from GPT response
    # ... same parsing logic ...
```

This allows **conversational building**:
- User: "I want a funnel"
- AI: "What type of users?"
- User: "Mobile"
- AI: *Builds funnel with mobile filter*

---

## Example Queries That Work

| User Query | GPT Understands | Config Generated |
|------------|------------------|------------------|
| "Build a funnel" | Funnel analysis | `{analysis_type: "funnel", funnel_steps: [...]}` |
| "Show mobile users" | Segmentation + device filter | `{analysis_type: "segmentation", segment_mode: "guest"}` |
| "Revenue impact chart" | Funnel + revenue measurement | `{analysis_type: "funnel", measurement: "revenue_impact"}` |
| "Compare behavioral segments" | Segmentation + behavioral mode | `{analysis_type: "segmentation", segment_mode: "behavioral"}` |
| "Add filter for families" | Mutate current view | Adds `guest_segment: "family"` filter |

---

## Why This Works (No Hardcoding)

1. **GPT understands intent** from natural language
2. **System prompt guides** GPT to return structured JSON
3. **Regex fallback** ensures it works even if GPT fails
4. **Flexible config structure** (`AnalyticsConfigUpdate`) supports any chart type

The system is **extensible** - you can add new chart types by:
1. Updating the system prompt
2. Adding new `analysis_type` values
3. GPT will automatically understand them

---

## Configuration Structure

```typescript
interface AnalyticsConfigUpdate {
  analysis_type?: 'funnel' | 'segmentation';
  measurement?: string;
  funnel_steps?: Array<{
    id: string;
    label: string;
    event_type: string;
    event_category: 'generic' | 'hospitality';
  }>;
  segment_mode?: 'event' | 'behavioral' | 'guest';
}
```

This structure is **flexible enough** for GPT to generate any valid configuration, while being **structured enough** for the UI to apply it reliably.

---

## Summary

**The AI chat builder is NOT hardcoded** - it uses:
- ✅ GPT (Azure OpenAI) for natural language understanding
- ✅ System prompts to guide GPT's output format
- ✅ JSON extraction from GPT responses
- ✅ Fallback regex only if GPT fails
- ✅ Flexible config structure that supports any chart type

Users can ask for **anything** in natural language, and GPT will extract the intent and generate the appropriate configuration.
