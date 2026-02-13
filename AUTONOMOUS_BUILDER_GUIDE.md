# Autonomous Funnel Builder - Complete Guide

## Overview

The Autonomous Funnel Builder allows users to build complete charts using natural language queries. It handles the **entire flow**:

1. **Parse Query** → Extract all parameters
2. **Build Config** → Create FunnelDefinition
3. **Query Database** → Fetch actual data from ClickHouse
4. **Render Chart** → Display the chart automatically

---

## Example Query

```
"Build a conversion funnel for booking: landed, location select, date select, room select 
with segment comparison device type = mobile, counting only unique users and completed within 1 day"
```

**What it extracts:**
- ✅ Steps: `landed`, `location select`, `date select`, `room select`
- ✅ Segment Comparison: `device_type = mobile`
- ✅ Counting Method: `unique_users`
- ✅ Completed Within: `1 day`
- ✅ View Type: `conversion` (default)

---

## How It Works

### 1. Query Parsing (`/api/ai/parse-funnel-query`)

The backend uses Azure GPT to extract all parameters:

```python
{
  "steps": ["landed", "location select", "date select", "room select"],
  "segmentComparison": {"dimension": "device_type", "value": "mobile"},
  "countingBy": "unique_users",
  "completedWithin": 1,
  "dateRange": null,
  "confidence": 95
}
```

### 2. Config Building (`buildFunnelDefinition`)

Converts parsed parameters to `FunnelDefinition`:

```typescript
{
  steps: [
    { id: "1", label: "landed", event_type: "Landed", event_category: "hospitality" },
    { id: "2", label: "location select", event_type: "Location Select", event_category: "hospitality" },
    // ...
  ],
  view_type: "conversion",
  completed_within: 1,
  counting_by: "unique_users",
  group_by: "device_type",
  segments: [{
    id: "segment-1",
    name: "device_type = mobile",
    filters: [{ property: "device_type", operator: "equals", value: "mobile" }]
  }]
}
```

### 3. Database Query (`fetchFunnelData`)

Queries ClickHouse using the config:

```typescript
const data = await fetchFunnelData(config);
// Returns: FunnelStep[] with visitors, conversion rates, etc.
```

### 4. Chart Rendering

Automatically renders using `FunnelLab` component.

---

## Usage

### Option 1: Use AutonomousFunnelBuilder Component

```tsx
import AutonomousFunnelBuilder from './components/AutonomousFunnelBuilder';

<AutonomousFunnelBuilder
  onConfigBuilt={(config) => {
    // Config is ready, chart is rendered automatically
    console.log('Built config:', config);
  }}
/>
```

### Option 2: Use Service Directly

```tsx
import { buildChartFromQuery } from '../services/autonomousBuilderService';

const result = await buildChartFromQuery({
  query: "Build conversion funnel: landed, location, date, room with mobile device comparison",
  currentConfig: null, // or existing config for mutation
});

// result.config → FunnelDefinition
// result.data → FunnelStep[] from database
// result.explanation → "Built funnel with 4 steps"
// result.confidence → 95
```

---

## Query Examples

### Basic Funnel
```
"Build a conversion funnel: landed, location select, date select, room select"
```

### With Segment Comparison
```
"Build funnel: landed, location, date, room with device type mobile comparison"
```

### With Counting Method
```
"Show conversion funnel counting by unique users: landed, location, date, room"
```

### With Time Window
```
"Build funnel completed within 1 day: landed, location, date, room"
```

### Complete Query
```
"Build a conversion funnel for booking: landed, location select, date select, room select 
with segment comparison device type = mobile, counting only unique users and completed within 1 day"
```

---

## Integration into Analytics Studio

Add to `AnalyticsStudio.tsx`:

```tsx
import AutonomousFunnelBuilder from './components/AutonomousFunnelBuilder';

// In the component:
const [showAutonomousBuilder, setShowAutonomousBuilder] = useState(false);

// Add button to trigger:
<button onClick={() => setShowAutonomousBuilder(true)}>
  <Sparkles /> Build with AI
</button>

// Show builder:
{showAutonomousBuilder && (
  <AutonomousFunnelBuilder
    onConfigBuilt={(config) => {
      // Apply config to Analytics Studio
      setFunnelConfig(config);
      setShowAutonomousBuilder(false);
    }}
  />
)}
```

---

## Backend Endpoints

### POST `/api/ai/parse-funnel-query`

**Request:**
```json
{
  "query": "Build conversion funnel: landed, location, date, room with mobile device comparison",
  "current_config": null
}
```

**Response:**
```json
{
  "steps": ["landed", "location select", "date select", "room select"],
  "segmentComparison": {"dimension": "device_type", "value": "mobile"},
  "countingBy": "unique_users",
  "completedWithin": 30,
  "explanation": "Built funnel with 4 steps for mobile users",
  "confidence": 95,
  "extractedParams": {
    "steps": ["landed", "location select", "date select", "room select"],
    "segmentComparison": {"dimension": "device_type", "value": "mobile"},
    "countingBy": "unique_users",
    "completedWithin": 30
  }
}
```

---

## Features

✅ **Complete Automation**: No manual configuration needed
✅ **Parameter Extraction**: Understands steps, segments, counting, time windows
✅ **Database Integration**: Automatically queries ClickHouse
✅ **Chart Rendering**: Renders chart immediately after build
✅ **Confidence Indicators**: Shows confidence level and asks for confirmation if low
✅ **Error Handling**: Graceful fallback to rule-based parsing if AI fails

---

## Testing

1. **Start Backend**: `uvicorn api:app --reload`
2. **Start Frontend**: `npm run dev`
3. **Open AutonomousFunnelBuilder** component
4. **Type Query**: "Build conversion funnel: landed, location, date, room with mobile device comparison, unique users, 1 day"
5. **Verify**:
   - Query is parsed correctly
   - Config is built
   - Database is queried
   - Chart renders automatically

---

## Fallback Behavior

If Azure GPT is unavailable, the system falls back to rule-based parsing:
- Extracts step keywords from query
- Infers counting method from keywords
- Extracts time window from numbers
- Lower confidence (75%) but still functional
