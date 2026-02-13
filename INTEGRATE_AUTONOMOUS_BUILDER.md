# Integrate Autonomous Builder into Analytics Studio

## Quick Integration (5 minutes)

### Step 1: Add to AnalyticsStudio.tsx

**Add import:**
```tsx
import AutonomousFunnelBuilder from './components/AutonomousFunnelBuilder';
```

**Add state:**
```tsx
const [showAutonomousBuilder, setShowAutonomousBuilder] = useState(false);
```

**Add button in header (around line 150):**
```tsx
<button
  onClick={() => setShowAutonomousBuilder(true)}
  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
>
  <Sparkles size={18} />
  <span>Build with AI</span>
</button>
```

**Add component in content area (around line 740):**
```tsx
{showAutonomousBuilder && (
  <div className="mb-6">
    <AutonomousFunnelBuilder
      onConfigBuilt={(config) => {
        // Convert FunnelDefinition to AnalyticsConfigUpdate
        const configUpdate: AnalyticsConfigUpdate = {
          analysis_type: 'funnel',
          measurement: 'conversion',
          funnel_steps: config.steps.map(s => ({
            id: s.id,
            label: s.label || s.event_type,
            event_type: s.event_type,
            event_category: s.event_category,
          })),
          funnel_view_type: config.view_type,
          funnel_completed_within: config.completed_within,
          funnel_counting_by: config.counting_by,
          funnel_group_by: config.group_by,
          funnel_segments: config.segments,
          funnel_global_filters: config.global_filters,
        };
        
        // Apply via existing ref
        if (applyConfigRef?.current) {
          applyConfigRef.current(configUpdate);
        }
        
        // Update local state
        setFunnelConfig(config);
        setShowAutonomousBuilder(false);
      }}
    />
  </div>
)}
```

---

## Alternative: Use in Ask AI Sidebar

**File:** `components/AskAISidebar.tsx`

Add a special handler for funnel queries:

```tsx
// Detect if query is a funnel build request
const isFunnelBuildQuery = /build.*funnel|conversion.*funnel|landed.*location/i.test(input);

if (isFunnelBuildQuery) {
  // Use autonomous builder
  const result = await buildChartFromQuery({
    query: input,
    currentConfig: currentViewConfig?.funnel_definition || null,
  });
  
  // Apply config
  const configUpdate = {
    analysis_type: 'funnel',
    measurement: 'conversion',
    funnel_steps: result.config.steps.map(s => ({
      id: s.id,
      label: s.label || s.event_type,
      event_type: s.event_type,
      event_category: s.event_category,
    })),
    // ... other fields
  };
  
  onApplyConfig?.(configUpdate);
  return;
}
```

---

## Test It

1. **Start Backend**: `uvicorn api:app --reload`
2. **Start Frontend**: `npm run dev`
3. **Click "Build with AI"** button
4. **Type**: `Build a conversion funnel for booking: landed, location select, date select, room select with segment comparison device type = mobile, counting only unique users and completed within 1 day`
5. **Click "Build Chart"**
6. **Verify**: Chart appears automatically with real data!

---

## What Gets Built

From your query, the system extracts:

```typescript
{
  steps: [
    { event_type: "Landed", event_category: "hospitality" },
    { event_type: "Location Select", event_category: "hospitality" },
    { event_type: "Date Select", event_category: "hospitality" },
    { event_type: "Room Select", event_category: "hospitality" }
  ],
  group_by: "device_type",
  segments: [{
    filters: [{ property: "device_type", operator: "equals", value: "mobile" }]
  }],
  counting_by: "unique_users",
  completed_within: 1,
  view_type: "conversion"
}
```

Then queries ClickHouse and renders the chart!

---

## Files to Modify

1. ✅ `components/AnalyticsStudio.tsx` - Add button and component
2. ✅ Backend already has `/api/ai/parse-funnel-query` endpoint
3. ✅ `services/autonomousBuilderService.ts` - Already created
4. ✅ `components/AutonomousFunnelBuilder.tsx` - Already created

Everything is ready - just integrate! 🚀
