# Quick Start - Autonomous Funnel Builder

## What It Does

You type a natural language query, and the system:
1. ✅ Parses your query
2. ✅ Extracts all parameters (steps, segments, counting method, time window)
3. ✅ Builds the funnel configuration
4. ✅ Queries ClickHouse database
5. ✅ Renders the chart automatically

**No manual configuration needed!**

---

## Example Query

```
Build a conversion funnel for booking: landed, location select, date select, room select 
with segment comparison device type = mobile, counting only unique users and completed within 1 day
```

**Result:** Complete funnel chart with:
- 4 steps (landed → location → date → room)
- Mobile device segment comparison
- Unique users counting
- 1-day conversion window
- Real data from ClickHouse

---

## How to Use

### Step 1: Add Component to Analytics Studio

**File:** `components/AnalyticsStudio.tsx`

```tsx
import AutonomousFunnelBuilder from './components/AutonomousFunnelBuilder';

// Add state
const [showBuilder, setShowBuilder] = useState(false);

// Add button in header
<button onClick={() => setShowBuilder(true)}>
  <Sparkles /> Build with AI
</button>

// Add component
{showBuilder && (
  <AutonomousFunnelBuilder
    onConfigBuilt={(config) => {
      // Config is automatically applied
      setFunnelConfig(config);
      setShowBuilder(false);
    }}
  />
)}
```

### Step 2: Test It

1. Start backend: `uvicorn api:app --reload`
2. Start frontend: `npm run dev`
3. Click "Build with AI" button
4. Type your query
5. Click "Build Chart"
6. Watch it build automatically!

---

## Query Format

The system understands:

### Steps
- "landed", "landing"
- "location select", "location"
- "date select", "date", "checkin"
- "room select", "room"
- "payment", "pay"
- "confirmation", "confirm"

### Segment Comparison
- "device type = mobile"
- "device type mobile"
- "mobile device comparison"
- "segment comparison device type = desktop"

### Counting Method
- "unique users", "unique_users", "users"
- "sessions"
- "events"

### Time Window
- "completed within 1 day"
- "1 day window"
- "within 7 days"
- "30 day conversion window"

---

## Complete Examples

### Basic
```
Build conversion funnel: landed, location, date, room
```

### With Segment
```
Build funnel: landed, location, date, room with mobile device comparison
```

### Full Query
```
Build a conversion funnel for booking: landed, location select, date select, room select 
with segment comparison device type = mobile, counting only unique users and completed within 1 day
```

### Mutation (Modify Existing)
```
Now filter that by families
```
(If a chart is already open, it modifies it instead of building new)

---

## What Happens Behind the Scenes

1. **Query Parsing** (`/api/ai/parse-funnel-query`)
   - Extracts: steps, segments, counting, time window
   - Returns structured JSON

2. **Config Building** (`buildFunnelDefinition`)
   - Converts to `FunnelDefinition` type
   - Maps step names to event types
   - Builds segment filters

3. **Database Query** (`fetchFunnelData`)
   - Calls `/api/funnel` endpoint
   - Queries ClickHouse with windowFunnel
   - Returns actual conversion data

4. **Chart Rendering**
   - Uses `FunnelLab` component
   - Displays conversion rates, drop-offs, etc.

---

## Testing Checklist

- [ ] Type query → Chart builds automatically
- [ ] Verify steps are correct
- [ ] Verify segment comparison works
- [ ] Verify counting method is applied
- [ ] Verify time window is correct
- [ ] Verify data comes from database (not mock)
- [ ] Test mutation mode (modify existing chart)

---

## Troubleshooting

**Query not parsed correctly?**
- Check backend logs for parsing errors
- Try simpler query format
- System falls back to rule-based parsing if AI fails

**No data in chart?**
- Verify ClickHouse has data for those events
- Check date range (may need to adjust)
- Verify event types match database

**Chart doesn't render?**
- Check browser console for errors
- Verify `FunnelLab` component is imported
- Check that config is valid `FunnelDefinition`

---

## Backend Endpoint

**POST** `/api/ai/parse-funnel-query`

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
  "confidence": 95
}
```

---

## Files Created

- `services/autonomousBuilderService.ts` - Complete end-to-end service
- `components/AutonomousFunnelBuilder.tsx` - UI component
- `api.py` - `/api/ai/parse-funnel-query` endpoint

All integrated and ready to use! 🚀
