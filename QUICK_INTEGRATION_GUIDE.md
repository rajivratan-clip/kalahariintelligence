# Quick Integration Guide - Add Components to UI for Testing

## Step 1: Add AnomalyAlert to Analytics Studio

**File:** `components/AnalyticsStudio.tsx`

Add at the top (with other imports):
```tsx
import AnomalyAlert from './AnomalyAlert';
```

Add in the content area (around line 740, before the main content):
```tsx
<div className="w-full px-6 py-6">
  {/* Anomaly Alerts */}
  <AnomalyAlert show={true} pollInterval={30000} />
  
  {/* Main Content */}
  {analysisType === 'funnel' && (
    // ... existing code
  )}
</div>
```

---

## Step 2: Add DynamicSuggestions to Analytics Studio

**File:** `components/AnalyticsStudio.tsx`

Add at the top:
```tsx
import DynamicSuggestions from './DynamicSuggestions';
```

Add after charts (around line 765, after FunnelLab):
```tsx
{analysisType === 'funnel' && (
  <>
    {/* ... existing FunnelLab code ... */}
    
    {/* Dynamic Suggestions */}
    <DynamicSuggestions
      currentViewConfig={session?.currentViewConfig || null}
      sessionHistory={session?.analyses || []}
      onSuggestionClick={(suggestion) => {
        console.log('Suggestion clicked:', suggestion);
        // You can implement action here
      }}
    />
  </>
)}
```

---

## Step 3: Add DataHealthWarning to Chart Components

**File:** `components/ChartRenderer.tsx` or any chart component

Add at the top:
```tsx
import DataHealthWarning from './DataHealthWarning';
import { checkDataHealth } from '../engines/dataHealthMonitor';
```

Add before chart rendering:
```tsx
const [healthReport, setHealthReport] = useState(null);

useEffect(() => {
  if (data && data.length > 0) {
    checkDataHealth(data, dataKeys[0] || 'value').then(setHealthReport);
  }
}, [data, dataKeys]);

return (
  <div>
    <DataHealthWarning healthReport={healthReport} />
    {/* ... existing chart code ... */}
  </div>
);
```

---

## Step 4: Test Root Cause Analysis in Ask AI

**File:** `services/geminiService.ts` (already updated)

When calling `generateInsight`, you can now pass `root_cause_analysis: true`:

```tsx
const response = await generateInsight(
  contextName,
  data,
  userQuery,
  currentView,
  sessionAnalyses,
  null, // conversationSummary
  true  // root_cause_analysis - ADD THIS
);
```

Or update `AskAISidebar.tsx` to include the flag when user asks "why" questions.

---

## Step 5: Test Segment Discovery

Add a button in Analytics Studio or Segment Studio:

```tsx
const handleDiscoverSegments = async () => {
  const response = await fetch('http://localhost:8000/api/ai/discover-segments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time_period_days: 30, min_sessions: 100 })
  });
  const data = await response.json();
  console.log('Discovered segments:', data.segments);
  // Display segments in UI
};

<button onClick={handleDiscoverSegments}>
  Discover Segments
</button>
```

---

## Quick Test Commands (Browser Console)

Once components are added, test in browser console:

```javascript
// 1. Check if anomalies are being detected
fetch('http://localhost:8000/api/ai/anomalies').then(r => r.json()).then(console.log)

// 2. Test suggestions API
fetch('http://localhost:8000/api/ai/suggestions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    current_view_config: { analysis_type: 'funnel' },
    session_history: []
  })
}).then(r => r.json()).then(console.log)

// 3. Test segment discovery
fetch('http://localhost:8000/api/ai/discover-segments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ time_period_days: 30, min_sessions: 100 })
}).then(r => r.json()).then(console.log)

// 4. Test conversation summarization
fetch('http://localhost:8000/api/ai/summarize-conversation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', text: 'Show conversion' },
      { role: 'model', text: 'Conversion is 25%' }
    ]
  })
}).then(r => r.json()).then(console.log)
```

---

## Visual Testing Checklist

After adding components:

- [ ] **AnomalyAlert**: Should appear at top of Analytics Studio, show alerts if anomalies detected
- [ ] **DynamicSuggestions**: Should appear below charts, show 3-5 suggestion cards
- [ ] **DataHealthWarning**: Should appear above charts when data issues detected
- [ ] **Root Cause Analysis**: In Ask AI, ask "why did conversion drop?" and verify structured breakdown
- [ ] **Segment Discovery**: Click "Discover Segments" button, verify segments appear with AI-generated names

---

## Troubleshooting

**Components not showing?**
- Check browser console for errors
- Verify imports are correct
- Check that components are inside the render tree

**API calls failing?**
- Verify backend is running on `http://localhost:8000`
- Check CORS settings in `api.py`
- Verify Azure OpenAI credentials are set

**No data in responses?**
- Some features need ClickHouse data (anomalies, segments)
- Check database connection
- Verify sample data exists
