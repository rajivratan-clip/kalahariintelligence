# Marketing Intelligence Platform - Testing Checklist

## Prerequisites
- [ ] Backend running: `uvicorn api:app --reload` (or `python -m uvicorn api:app --reload`)
- [ ] Frontend running: `npm run dev`
- [ ] Azure OpenAI credentials configured (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT)
- [ ] ClickHouse database connected and populated with sample data

---

## Phase 1: Semantic Layer Foundation ✅

### 1.1 Schema Enhancement
- [ ] **Test Basic Schema Endpoint**
  - Navigate to browser console
  - Run: `fetch('http://localhost:8000/api/metadata/schema').then(r => r.json()).then(console.log)`
  - Verify response includes `last_scan_timestamp` field

- [ ] **Test Detailed Schema Endpoint**
  - Run: `fetch('http://localhost:8000/api/metadata/schema/detailed').then(r => r.json()).then(console.log)`
  - Verify response includes:
    - `event_frequency` array with event counts
    - `page_url_patterns` array
    - `property_correlations` object
    - `last_scan_timestamp`

- [ ] **Test Semantic Dictionary (Frontend)**
  - Open browser DevTools → Console
  - Run: `import('/engines/semanticDictionary.ts').then(m => { const dict = m.useSemanticDictionary.getState(); console.log(dict.mappings); dict.syncFromBackend(); })`
  - Verify mappings are cached after sync

---

## Phase 2: Autonomous Analyst Agents ✅

### 2.1 Anomaly Detection
- [ ] **Check Anomalies Endpoint**
  - Run: `fetch('http://localhost:8000/api/ai/anomalies').then(r => r.json()).then(console.log)`
  - Verify response structure: `{ anomalies: [], last_check_timestamp: "...", count: 0 }`
  - Note: May be empty initially if no anomalies detected

- [ ] **Verify Background Task**
  - Check backend console logs
  - Look for: "Background anomaly check" messages every 15 minutes
  - Or manually trigger: Check if anomalies appear after waiting

- [ ] **Test AnomalyAlert Component**
  - Open Analytics Studio in the UI
  - Look for `AnomalyAlert` component (if integrated into AnalyticsStudio)
  - Or manually add to a component:
    ```tsx
    import AnomalyAlert from './components/AnomalyAlert';
    <AnomalyAlert show={true} />
    ```
  - Verify it polls `/api/ai/anomalies` every 30 seconds
  - Verify high/medium severity anomalies display with red/amber styling

### 2.2 Root Cause Analysis
- [ ] **Test Root Cause Flag in AI Insight**
  - Open Ask AI sidebar
  - Type: "Analyze this funnel and explain why conversion dropped"
  - Check network tab for POST to `/api/ai/insight`
  - Verify request includes `root_cause_analysis: true` (if implemented in frontend)
  - Verify response includes structured root cause breakdown

---

## Phase 3: Dynamic Suggestions Engine ✅

### 3.1 Suggestions API
- [ ] **Test Suggestions Endpoint**
  - Create a funnel or segmentation view in Analytics Studio
  - Open browser console
  - Run:
    ```javascript
    fetch('http://localhost:8000/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_view_config: { analysis_type: 'funnel', funnel_definition: { steps: [] } },
        session_history: []
      })
    }).then(r => r.json()).then(console.log)
    ```
  - Verify response includes `suggestions` array with:
    - `id`, `type`, `title`, `description`, `action_score`, `suggested_action`

### 3.2 DynamicSuggestions Component
- [ ] **Test Suggestions UI**
  - Add `DynamicSuggestions` component to Analytics Studio:
    ```tsx
    import DynamicSuggestions from './components/DynamicSuggestions';
    import { useAiOrchestrator } from './engines/useAiOrchestrator';
    
    const session = useAiOrchestrator(state => state.getActiveSession());
    <DynamicSuggestions 
      currentViewConfig={session?.currentViewConfig} 
      sessionHistory={session?.analyses || []}
    />
    ```
  - Verify suggestions appear below charts
  - Click a suggestion and verify it triggers the suggested action
  - Verify suggestions refresh when config changes

---

## Phase 4: Data Health Monitoring ✅

### 4.1 Data Health Checker
- [ ] **Test Data Health Monitor**
  - Open browser console
  - Run:
    ```javascript
    import('/engines/dataHealthMonitor.js').then(m => {
      m.checkDataHealth([
        { name: 'Day 1', value: 100 },
        { name: 'Day 2', value: 0 },
        { name: 'Day 3', value: 0 },
        { name: 'Day 4', value: 0 },
        { name: 'Day 5', value: 150 }
      ], 'value').then(console.log)
    })
    ```
  - Verify warnings for consecutive zeros detected

### 4.2 DataHealthWarning Component
- [ ] **Test Health Warning UI**
  - Add `DataHealthWarning` component above charts:
    ```tsx
    import DataHealthWarning from './components/DataHealthWarning';
    import { checkDataHealth } from './engines/dataHealthMonitor';
    
    const [healthReport, setHealthReport] = useState(null);
    useEffect(() => {
      checkDataHealth(chartData, 'value').then(setHealthReport);
    }, [chartData]);
    
    <DataHealthWarning healthReport={healthReport} />
    ```
  - Verify warnings display when data issues detected
  - Verify "Data quality looks good" message when no issues

---

## Phase 5: Enhanced Context Management ✅

### 5.1 Conversation Summarization
- [ ] **Test Summarize Endpoint**
  - Run:
    ```javascript
    fetch('http://localhost:8000/api/ai/summarize-conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', text: 'Show me mobile conversion' },
          { role: 'model', text: 'Mobile conversion is 25%' },
          { role: 'user', text: 'Why is it low?' },
          { role: 'model', text: 'Due to payment issues' }
        ]
      })
    }).then(r => r.json()).then(console.log)
    ```
  - Verify response includes `summary` field

- [ ] **Test Orchestrator Summarization**
  - Open browser console
  - Run:
    ```javascript
    import('/engines/useAiOrchestrator.js').then(m => {
      const orchestrator = m.useAiOrchestrator.getState();
      const session = orchestrator.getActiveSession();
      if (session && session.messages.length >= 5) {
        orchestrator.summarizeConversation(session.id).then(console.log);
      }
    })
    ```
  - Verify summary stored in `session.metadata.conversation_summary`

### 5.2 Context Compression
- [ ] **Test Conversation Summary in AI Requests**
  - Check network tab when using Ask AI
  - Verify `conversation_summary` included in request to `/api/ai/insight`
  - Verify AI responses maintain context from summary

---

## Phase 6: Component Streaming System ✅

### 6.1 Dynamic Chart Renderer
- [ ] **Test DynamicChartRenderer Component**
  - Create a component spec:
    ```javascript
    const spec = {
      component: 'BarChart',
      data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }],
      config: { xKey: 'name', yKey: 'value' },
      title: 'Test Chart'
    };
    ```
  - Render: `<DynamicChartRenderer spec={spec} />`
  - Verify chart renders correctly

### 6.2 UI Architect Agent
- [ ] **Test Generate UI Flag**
  - In Ask AI sidebar, type: "Build me a bar chart showing revenue by device"
  - Check network tab for POST to `/api/ai/guided-build`
  - Verify request includes `generate_ui: true` (if implemented in frontend)
  - Verify response includes `component_spec` JSON
  - Verify component spec can be rendered with `DynamicChartRenderer`

---

## Phase 7: Predictive Layer ✅

### 7.1 Intent Scoring Enhancement
- [ ] **Test Enhanced Intent Score**
  - Open browser console
  - Run:
    ```javascript
    import('/engines/hospitalityTrends.js').then(m => {
      const score = m.calculateIntentScore(
        4, // funnelDepth
        6, // maxSteps
        180, // timeOnSite (3 minutes)
        true, // hasInteractions
        { priceViewed: 250, nightsSelected: 2, addonsViewed: 1 } // additionalFeatures
      );
      console.log('Intent Score:', score);
    })
    ```
  - Verify score includes feature bonuses (should be > base score)

### 7.2 Segment Discovery
- [ ] **Test Discover Segments Endpoint**
  - Run:
    ```javascript
    fetch('http://localhost:8000/api/ai/discover-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_period_days: 30,
        min_sessions: 100
      })
    }).then(r => r.json()).then(console.log)
    ```
  - Verify response includes `segments` array with:
    - `name` (AI-generated segment name)
    - `rfm_scores` (recency, frequency, monetary)
    - `metrics` (user_count, avg_conversions, etc.)
  - Verify segments are sorted by value (high RFM scores first)

---

## Integration Testing

### End-to-End Flows

- [ ] **Complete AI Analysis Flow**
  1. Open Analytics Studio
  2. Build a funnel via Ask AI: "Build me a booking funnel"
  3. Verify funnel appears
  4. Ask AI: "Why did conversion drop at Room Select?"
  5. Verify root cause analysis appears
  6. Check suggestions appear below chart
  7. Click a suggestion (e.g., "Compare by Device Type")
  8. Verify chart updates

- [ ] **Anomaly Detection Flow**
  1. Wait for background anomaly check (or manually trigger)
  2. Verify anomalies appear in AnomalyAlert component
  3. Click to expand anomaly details
  4. Verify anomaly metadata displays correctly

- [ ] **Data Health Flow**
  1. Create a chart with problematic data (many zeros, outliers)
  2. Verify DataHealthWarning appears above chart
  3. Verify warnings are specific to data issues
  4. Verify suggestions for fixing issues appear

- [ ] **Context Management Flow**
  1. Have a long conversation in Ask AI (10+ messages)
  2. Verify conversation summary is generated
  3. Continue conversation
  4. Verify AI maintains context from summary
  5. Check that token usage is reduced (if monitoring)

---

## Performance Testing

- [ ] **Backend Performance**
  - Check response times for all new endpoints (< 2 seconds)
  - Verify background tasks don't block main API
  - Check memory usage (anomaly cache should be limited)

- [ ] **Frontend Performance**
  - Verify suggestions load without blocking UI
  - Check that polling (anomalies, suggestions) doesn't cause lag
  - Verify component rendering is smooth

---

## Error Handling

- [ ] **Test Error Cases**
  - Disconnect backend → Verify graceful error messages
  - Invalid API keys → Verify fallback to rule-based logic
  - Empty data → Verify appropriate warnings
  - Network errors → Verify retry logic or user notifications

---

## Browser Console Commands for Quick Testing

```javascript
// Test all endpoints at once
async function testAll() {
  const tests = {
    schema: await fetch('http://localhost:8000/api/metadata/schema').then(r => r.json()),
    detailedSchema: await fetch('http://localhost:8000/api/metadata/schema/detailed').then(r => r.json()),
    anomalies: await fetch('http://localhost:8000/api/ai/anomalies').then(r => r.json()),
    suggestions: await fetch('http://localhost:8000/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_view_config: {}, session_history: [] })
    }).then(r => r.json()),
    discoverSegments: await fetch('http://localhost:8000/api/ai/discover-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_period_days: 30, min_sessions: 100 })
    }).then(r => r.json())
  };
  console.table(tests);
}
testAll();
```

---

## Notes

- Some features require data in ClickHouse to work properly (anomalies, segment discovery)
- Azure GPT features will fall back to rule-based logic if API keys are not configured
- Background tasks run every 15 minutes - be patient or check logs
- Frontend components need to be integrated into existing views (AnalyticsStudio, etc.)
