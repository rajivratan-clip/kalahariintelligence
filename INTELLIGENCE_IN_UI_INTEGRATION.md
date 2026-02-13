# Intelligence in the UI - Integration Guide

## Overview

This guide shows how to integrate the new "Intelligence in the UI" features into your existing components.

---

## 1. Automatic Insight Overlays

### Add to Chart Components

Wrap any chart with `ChartWithInsights`:

```tsx
import ChartWithInsights from './components/ChartWithInsights';
import ChartRenderer from './components/ChartRenderer';

// In your component:
<ChartWithInsights
  chartData={chartData}
  chartType="bar"
  xAxisKey="name"
  onInsightAction={(action) => {
    console.log('Action clicked:', action);
    // Apply the action (e.g., navigate to segment breakdown)
  }}
>
  <ChartRenderer
    type="bar"
    data={chartData}
    dataKeys={['value']}
  />
</ChartWithInsights>
```

### Backend Endpoint

The `/api/ai/chart-insights` endpoint is already created. It:
- Analyzes chart data for spikes, drops, anomalies
- Returns micro-insights with suggested actions
- Uses Azure GPT for natural language explanations

---

## 2. Autonomous Chart Builder

### Add Builder UI Component

```tsx
import AutonomousBuilderUI from './components/AutonomousBuilderUI';

// In Analytics Studio or any view:
<AutonomousBuilderUI
  onBuildComplete={(configUpdate) => {
    // Apply the config update
    applyConfigRef.current?.(configUpdate);
  }}
/>
```

### Features

- **NL-to-Config**: Converts "Show conversion rate for mobile users" → chart config
- **Mutation Mode**: If chart exists, modifies it instead of rebuilding
- **Confidence Indicators**: Shows disclaimers when confidence < 90%
- **Undo Support**: Revert to previous state with undo button

### Backend Endpoint

`/api/ai/autonomous-build` handles:
- Intent extraction from natural language
- Config generation or mutation
- Component spec generation for dynamic rendering

---

## 3. Adaptive Suggestions

### Add to Views

```tsx
import { useAdaptiveSuggestions } from '../engines/useAdaptiveSuggestions';

// In your component:
const { suggestions, isGenerating } = useAdaptiveSuggestions(
  currentViewConfig,
  chartData,
  selectedDataPoint // Optional: when user clicks a data point
);

// Render suggestions:
{suggestions.map((suggestion) => (
  <button
    key={suggestion.id}
    onClick={() => {
      // Apply suggestion action
      handleSuggestionAction(suggestion.action);
    }}
    className="..."
  >
    {suggestion.label}
  </button>
))}
```

### How It Works

- **Heuristic Map**: Maps metrics to "natural neighbors" (Revenue → ADR → Occupancy)
- **Context Awareness**: Adapts based on current view and selected data points
- **AI Enhancement**: Uses `/api/ai/adaptive-suggestions` to refine suggestions

---

## 4. Confidence Indicators

### Usage

```tsx
import ConfidenceIndicator from './components/ConfidenceIndicator';

<ConfidenceIndicator
  confidence={75}
  assumption="I'm assuming 'Landed' refers to your PageView event"
  message="Is this correct?"
  onConfirm={() => {
    // Proceed with assumption
  }}
  onCancel={() => {
    // Let user correct
  }}
/>
```

### Behavior

- **≥90%**: Subtle green indicator (high confidence)
- **70-89%**: Amber warning with confirmation buttons
- **<70%**: Red alert requiring explicit confirmation

---

## 5. Animated Reasoning

### Usage

```tsx
import AnimatedReasoning from './components/AnimatedReasoning';

<AnimatedReasoning
  steps={[
    'Scanning ClickHouse for anomalies...',
    'Mapping city names to geo-segments...',
    'Building chart specification...',
  ]}
  onComplete={() => {
    // Loading complete
  }}
/>
```

### Features

- Auto-advances through steps (1.5s per step)
- Shows checkmarks for completed steps
- Spinning icon for current step

---

## 6. Undo System

### Already Integrated

The `useAutonomousBuilder` hook includes undo functionality:

```tsx
const { undoLastBuild, canUndo } = useAutonomousBuilder();

<UndoButton
  onUndo={() => undoLastBuild(sessionId)}
  canUndo={canUndo}
/>
```

### How It Works

- Keeps last 10 config states in history
- One-click revert to previous state
- Works with mutation mode (reverts mutations)

---

## Complete Integration Example

### Analytics Studio Integration

```tsx
import React, { useState } from 'react';
import ChartWithInsights from './components/ChartWithInsights';
import AutonomousBuilderUI from './components/AutonomousBuilderUI';
import { useAdaptiveSuggestions } from '../engines/useAdaptiveSuggestions';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';

const AnalyticsStudioEnhanced = () => {
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const session = useAiOrchestrator(state => state.getActiveSession());
  
  const { suggestions } = useAdaptiveSuggestions(
    session?.currentViewConfig,
    chartData,
    selectedDataPoint
  );

  return (
    <div>
      {/* Autonomous Builder */}
      <AutonomousBuilderUI
        onBuildComplete={(config) => {
          // Apply config
        }}
      />

      {/* Chart with Insights */}
      <ChartWithInsights
        chartData={chartData}
        chartType="bar"
        onInsightAction={(action) => {
          // Handle insight action
        }}
      >
        <ChartRenderer data={chartData} type="bar" />
      </ChartWithInsights>

      {/* Adaptive Suggestions */}
      <div className="mt-4">
        <h3>Suggestions</h3>
        {suggestions.map((s) => (
          <button key={s.id} onClick={() => handleSuggestion(s)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

## Testing Checklist

- [ ] **Insight Overlays**: Sparkle icons appear on charts, show insights when clicked
- [ ] **Autonomous Builder**: Type query → chart builds automatically
- [ ] **Mutation Mode**: Modify existing chart with "Now filter by families"
- [ ] **Confidence Indicators**: Low confidence shows confirmation dialog
- [ ] **Animated Reasoning**: Loading states show step-by-step progress
- [ ] **Undo Button**: Revert to previous chart state
- [ ] **Adaptive Suggestions**: Suggestions change based on current view

---

## Backend Endpoints Summary

1. **POST `/api/ai/chart-insights`** - Generate micro-insights from chart data
2. **POST `/api/ai/autonomous-build`** - Build or mutate charts from NL
3. **POST `/api/ai/adaptive-suggestions`** - Generate context-aware suggestions

All endpoints are backward compatible and optional - existing functionality continues to work.
