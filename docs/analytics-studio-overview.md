## ResortIQ Analytics Studio – Deep Product Overview

This document explains what the Analytics Studio in ResortIQ does, how it fits into the overall app, and how the different analysis modes, metrics, and AI workflows work end‑to‑end.

---

## 1. High‑Level App Overview

The app is a React single‑page application focused on hospitality analytics and experimentation for hotel / resort booking funnels.

- **Primary modules in the left navigation**
  - **Analytics Studio**: Unified analysis surface for funnel analytics, segmentation, revenue impact, and hospitality‑specific KPIs.
  - **Funnel Lab**: Dedicated workspace to define, run, and visualize booking funnels.
  - **Segment Studio**: Tools to define, compare, and explore behavioral and guest segments.
  - **Friction Forensic**: UX friction and failure analysis (rage clicks, drop‑off steps, etc.).
  - **Ask AI**: An AI assistant sidebar that explains any current analysis and can also build analytics configurations for you.

From `App.tsx`:

- **View routing** is controlled via `activeView: ViewMode` with values `analytics | funnel | segment | friction`.
- The **sidebar** defines a dedicated nav item: `⭐ Analytics Studio` mapped to `view: 'analytics'`.
- The **Ask AI sidebar** (`AskAISidebar`) receives:
  - The current `activeView`.
  - An `AiContext` object describing what the user is looking at.
  - A callback `onApplyConfig` which lets AI push an `AnalyticsConfigUpdate` back into Analytics Studio and Segment Studio.

This means Analytics Studio is not an isolated page; it is the “home” of analytics configuration and benefits heavily from the global Ask AI workflows.

---

## 2. Core Data & Types Used by Analytics Studio

Key types are defined in `types.ts` and reused across Funnel Lab, Segmentation, and Analytics Studio.

- **FunnelStepConfig**
  - Represents one logical step in a funnel:
    - `id: string`
    - `label?: string` (human‑friendly label such as “Landed”, “Room Select”)
    - `event_category: 'generic' | 'hospitality'`
    - `event_type: string` (e.g. `Page Viewed`, `Room Select`, `Payment`)
    - `filters?: EventFilter[]` (rich property filters: equals, contains, greater_than, in, is_null, etc.)

- **FunnelDefinition**
  - Full definition of a funnel used across the product:
    - `steps: FunnelStepConfig[]`
    - `view_type`: one of several “Measured As” styles, e.g. `conversion`, `overTime`, `timeToConvert`, etc.
    - `completed_within`: conversion window in days.
    - `counting_by`: `unique_users | sessions | events`.
    - `order`: `strict | loose | any`.
    - `group_by` and `segments` for more advanced comparison.

- **AnalyticsConfigUpdate**
  - Shape of configuration that the AI assistant can send back:
    - `analysis_type?: 'funnel' | 'segmentation'`
    - `measurement?: string`
    - `funnel_steps?: { id; label; event_type; event_category }[]`
    - `segment_mode?: 'event' | 'behavioral' | 'guest'`

Analytics Studio is explicitly built around these types so that:

- The UI is strongly typed and safe.
- The AI assistant can read and **write** these same configurations via a single payload shape.

---

## 3. Analytics Studio – Conceptual Model

Analytics Studio (`components/AnalyticsStudio.tsx`) is designed as a **unified container** for multiple analysis types:

- **Analysis Types**
  - `funnel`
  - `segmentation`
  - `retention` (coming soon)
  - `paths` (coming soon)

- **Measurement Types**
  - For **funnel**:
    - `conversion`: classic step‑by‑step conversion.
    - `over_time`: trends of conversion over time.
    - `time_to_convert`: time spent per step / time to complete.
    - `path_analysis`: user journey patterns through steps.
    - `price_sensitivity`: how price affects conversion.
    - `cohort_analysis`: compares user cohorts.
    - `executive_summary`: high‑level summary view.
    - `revenue_impact`: deep revenue‑at‑risk view (custom view).
    - `ai_insights`: AI‑driven forensic analysis (integrated via Ask AI).
    - `hospitality_metrics`: hospitality KPIs like ADR, LOS, etc. (custom view).
  - For **segmentation**:
    - `uniques`: unique users count.
    - `event_totals`: total events.
    - `active_percent`: percent of active users.
    - `average`: average per user.
    - `frequency`: event frequency.
    - `revenue_per_user`: revenue metrics by user.
    - `hospitality_breakdown`: hospitality specific breakdown (ADR, LOS, RevPAR by segment).

In the UI:

- The **top tabs** let the user pick the analysis type: Funnel Analysis, Segmentation, Retention, Paths.
- The **“Measured as” selector** is a single dropdown that automatically adapts the list of options based on the selected analysis type.

---

## 4. Default Hospitality Funnel Template

Analytics Studio initializes with a **hospitality‑specific funnel** so that product demos are meaningful immediately:

- Steps are configured as:
  1. `Page Viewed` – label: “Landed”.
  2. `Location Select` – label: “Location Select”.
  3. `Date Select` – label: “Date Select”.
  4. `Room Select` – label: “Room Select”.
  5. `Payment` – label: “Payment”.
  6. `Confirmation` – label: “Confirmation”.

Each of these is marked with `event_category: 'hospitality'`.

This default funnel is used by:

- The embedded **Funnel Lab** view for standard funnel metrics.
- The **Revenue Impact** and **Hospitality Metrics** views, which send this funnel definition to backend endpoints tailored for hospitality analytics.

---

## 5. AI‑Powered Guided Build Integration

Analytics Studio is tightly integrated with the Ask AI sidebar for both **explanations** and **guided building** of analysis configurations.

### 5.1. Ask AI: Explaining Current Analysis

- Analytics Studio keeps a `explainPayloadGetterRef`.
  - Child components like `FunnelLab` and `SegmentationView` register a getter that returns:
    - A `title` (e.g. “Segmentation Analysis”).
    - A structured `data` payload (current filters, funnel steps, segments, results, etc.).
- When the user clicks the **Ask AI** button in the Analytics Studio header:
  - The app opens the Ask AI sidebar.
  - If a child view has registered a payload getter and has data, that structured payload is passed to AI via `onExplain`.
  - If no child payload is registered yet (e.g. no data), Analytics Studio falls back to a generic payload describing:
    - Current `analysis_type`.
    - Current `measurement`.
    - The current funnel configuration (for funnel mode).

This design ensures the AI assistant always has enough context to respond with **specific, actionable insights** instead of generic answers.

### 5.2. Ask AI: AI‑Guided Build (Apply Config)

The `App` component and Analytics Studio share a reference:

- In `App.tsx`:
  - `applyConfigRef` is a `useRef<ConfigApplicator | null>`.
  - Ask AI calls `onApplyConfig(updates: AnalyticsConfigUpdate)` when it wants to “build” a chart or analysis.
  - On success, the app shows a toast such as:
    - “Funnel built with N steps” if `analysis_type === 'funnel'`.
    - “Segmentation chart ready” if `analysis_type === 'segmentation'`.

- In `AnalyticsStudio.tsx`:
  - On mount, Analytics Studio **registers** a function into `applyConfigRef.current`.
  - That function:
    - Updates `analysisType` and `measurement` if provided.
    - Maps `updates.funnel_steps` into the strongly‑typed `FunnelStepConfig[]` and updates the stored `funnelConfig`.
    - Stores these injected steps in `injectedFunnelSteps`, which are then passed to `FunnelLab` as overrides.
    - Applies `segment_mode` updates into `injectedSegmentMode`, which SegmentationView uses.

Effectively:

- AI can propose a funnel (“Build me a funnel from landing page to payment for mobile users”) and **the UI will reflect it automatically**.
- AI can also jump you into a segmentation mode (event‑based vs behavioral vs guest) based on natural language instructions.

---

## 6. Event Schema Integration

Analytics Studio loads the **event schema** from the backend so it can render generic and hospitality‑specific events consistently:

- On mount, it calls:
  - `GET http://localhost:8000/api/metadata/schema`
- If successful, the response JSON is stored in `eventSchema` state.
- `eventSchema` is passed down into `SegmentationView` via props.

This allows:

- Dynamic handling of event types and properties.
- Future extensions where the UI can be fully driven by schema (e.g. event property pickers, advanced filters) without hard‑coding event names.

---

## 7. Funnel Analysis in Analytics Studio

When `analysisType === 'funnel'`, Analytics Studio coordinates several views based on the selected measurement.

### 7.1. Revenue Impact View

When `measurement === 'revenue_impact'`, the `RevenueImpactView` component is rendered.

- **Backend endpoint**
  - `POST http://localhost:8000/api/analytics/revenue-impact`
  - Request body: the current `FunnelDefinition` (steps, view_type, window, etc.).

- **What it computes and displays**
  - **Total revenue at risk**
    - Aggregated across all steps, exposed as `total_revenue_at_risk`.
    - Shown as a primary KPI card for the selected period.
  - **Biggest revenue leak**
    - Uses `revenue_per_step[0]` as the largest leak step.
    - Displays step name and revenue lost at that step.
  - **Average loss per dropped user**
    - From `avg_revenue_per_user`, rendered as a KPI.
  - **Revenue lost per step (chart)**
    - Uses Recharts `BarChart` to visualize `revenue_lost` by funnel step.
  - **Segment breakdown (optional)**
    - If `has_segments` is true and `segment_breakdown` is populated:
      - Shows revenue lost by segment, in both absolute values and percentage of total.
      - This directly connects revenue leaks to audience segments.
  - **What‑if scenarios**
    - Uses `improvement_opportunities` to show:
      - Projected revenue if drop‑off is reduced by 10%, 25%, 50%.
    - Also shows a computed **total annual opportunity** by extrapolating potential recovery over a year.
  - **Detailed step‑by‑step table**
    - For each step:
      - Sessions dropped.
      - Revenue lost.
      - Average revenue per user.
      - Unconverted count.

The result: a **C‑level revenue lens** on funnel performance: not just conversion loss, but concrete money and opportunity.

### 7.2. Hospitality Metrics View

When `measurement === 'hospitality_metrics'`, the `HospitalityMetricsView` is shown.

- **Backend endpoint**
  - `POST http://localhost:8000/api/analytics/hospitality-metrics`
  - Request body: the current `FunnelDefinition`.

- **What it computes and displays**
  - **Topline hospitality KPIs**
    - ADR (Average Daily Rate).
    - Average length of stay.
    - Average booking value.
    - Total revenue for the period.
    - Number of completed bookings.
  - **Guest segment performance**
    - Bar chart by segment:
      - Sessions.
      - Conversions.
      - Conversion rate.
  - **Booking intent distribution**
    - Pie chart of intent levels (e.g. low/medium/high).
    - Average potential revenue per intent bucket.
  - **Ancillary revenue impact (add‑ons)**
    - Sessions where add‑ons were viewed.
    - Average booking value with vs without add‑ons.
    - Add‑on revenue lift percentage.
    - Narrative insight summarizing uplift from add‑ons.
  - **Detailed segment breakdown table**
    - For each segment:
      - Sessions and conversions.
      - Conversion rate.
      - Average intent score.
      - Average booking value.
      - Average nights.

This view reframes the same funnel data around **hospitality‑native metrics** rather than generic SaaS conversion metrics.

### 7.3. Standard FunnelLab Embedding

For all other funnel measurements (conversion, over time, time to convert, path analysis, price sensitivity, cohorts, executive summary), Analytics Studio embeds the existing `FunnelLab` component:

- The component is passed:
  - `initialMeasurement`: current measurement type.
  - `isEmbedded: true` so it behaves as a sub‑view.
  - `onExplain` and `onExplainPayloadReady` to integrate with Ask AI.
  - `injectedSteps` created from AI guided build, plus a callback when those are consumed.
- FunnelLab is responsible for:
  - Fetching analytic results from the backend for those view types.
  - Rendering charts and step tables.
  - Surfacing a structured explanation payload to AI.

---

## 8. Segmentation Analysis in Analytics Studio

When `analysisType === 'segmentation'`, Analytics Studio renders the `SegmentationView` component and passes down:

- The loaded `eventSchema`.
- The same `onExplain` and `onExplainPayloadReady` hooks for AI.
- Any injected `segmentMode` from the AI guided build.

### 8.1. Segment Modes

SegmentationView supports three major segment modes:

- **Event‑based segments (`segmentMode = 'event'`)**
  - User defines a list of events (e.g. `Page Viewed`, `Room Select`, `Payment`).
  - Each event has a label and filters.
  - Backend endpoint:
    - `POST /api/analytics/segmentation`.
  - Parameters include:
    - List of events.
    - Measurement (`uniques`, `event_totals`, `average`, `revenue_per_user`).
    - Time period, group by dimension, and interval.
  - Outputs:
    - Per‑event metric value.
    - Time series for each event.
    - Optional breakdown by group (e.g. device type, guest segment).

- **Behavioral segments (`segmentMode = 'behavioral'`)**
  - Pre‑defined patterns such as:
    - Researchers, Bargain Hunters, Last‑Minute Bookers, High‑Friction Droppers, High‑Intent Non‑Bookers, Converters, Other.
  - Backend endpoint:
    - `POST /api/analytics/behavioral-segments`.
  - Parameters:
    - Time period, interval, optional list of selected segment IDs.
  - Outputs:
    - List of segments with:
      - Sessions, conversions, conversion rate, revenue, average potential revenue.
      - Optional share of total sessions.
    - Time series per segment, rendered in a line chart.

- **Guest segments (`segmentMode = 'guest'`)**
  - Focused on guest / user profiles:
    - Families, Luxury Seekers, Couples, Business Travelers, Returning vs New, Mobile vs Desktop, High‑Value, Price‑Sensitive, etc.
  - Backend endpoint:
    - `POST /api/analytics/guest-segments`.
  - Same pattern as behavioral segments: segments list + time series over time.

### 8.2. Controls and Dimensions

Shared controls across segment modes:

- **Time period**:
  - Last 7, 14, 30, 60, 90 days.
- **Interval**:
  - Day, week, month.

Event‑based mode adds:

- **Measurement selector**:
  - Uniques, event totals, average per user, revenue per user.
- **Group by selector**:
  - Example dimensions: device type, guest segment, traffic source, browser, returning vs new.
- **Event list editor**:
  - Add/remove events.
  - Choose from predefined hospitality and generic events.
  - Apply custom labels.

### 8.3. Output Visualizations and Insights

Key visualizations in SegmentationView:

- **Summary metrics cards**
  - One card per event or segment, showing the main metric value and label.
- **Trends over time**
  - Combined line chart across events or segments.
- **Breakdown charts**
  - Bar charts by group dimension for event‑based breakdowns.
- **Narrative insights**
  - A dedicated section that describes trends (e.g. percent growth/decline over the period).

Like FunnelLab, SegmentationView registers an **explain payload** with:

- Segment mode, measurement, time period, group by, interval.
- Events + results for event‑based mode.
- Behavioral or guest segment responses for the other modes.

Ask AI can then generate targeted commentary, such as:

- Which guest segments have the highest intent but do not convert.
- Which behaviors drive the largest share of revenue.
- How different device types perform for a specific event.

---

## 9. Retention and Paths (Coming Soon)

Analytics Studio already wires up tabs for:

- **Retention**
- **Paths**

Currently these are placeholders:

- Selecting these tabs shows a “Coming Soon” card.
- This is the surface where retention curves and path analysis (beyond the basic funnel) will live.

The important part is the **frame is already in place**:

- Analysis type switching.
- Measurement selector.
- AI context integration.

This makes it easy to plug in new backend endpoints and visualizations without re‑architecting the page.

---

## 10. How Someone New Should Use Analytics Studio

From a user’s perspective, a practical “first‑time” flow would be:

1. **Open Analytics Studio from the sidebar.**
2. **Review the default hospitality funnel** (Landing → Location → Dates → Room → Payment → Confirmation).
3. **Switch “Measured as” to “Revenue Impact”** to understand where revenue is being lost in the booking journey.
4. **Switch to “Hospitality Metrics”** for ADR/LOS/ABV and segment breakdown.
5. **Use Ask AI**:
   - Ask “Explain where my biggest revenue leak is and which segments are most affected.”
   - Optionally, ask: “Build a funnel focused only on mobile users” and let AI update the funnel steps.
6. **Switch to Segmentation**:
   - Start with event‑based mode to compare key events.
   - Explore behavioral and guest views to see how different traveler types behave.
7. **Share insights**:
   - Since everything is backed by a strict type model and consistent endpoints, the same configuration can be saved and revisited (the UI has a “Save Analysis” entry point for this).

This workflow showcases why Analytics Studio is meant to be a **single, hospitality‑native place to investigate performance, revenue, and guest behavior**, with AI tightly integrated into both the exploration and the configuration steps.

