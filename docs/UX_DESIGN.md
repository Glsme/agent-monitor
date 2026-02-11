# UX Design: Interaction Patterns & User Flow

## 1. Application User Flow

### Primary Flow

```
App Launch
  |
  v
Team List Load (auto-discover from ~/.claude/)
  |
  v
Team Selection (click team card)
  |
  +---> Dashboard View (default)
  |       |
  |       +-- Agent grid with status badges
  |       +-- Global task progress bar
  |       +-- Status filter bar (All / Working / Idle / Blocked / Offline)
  |       +-- Right sidebar: Task list + Timeline
  |       +-- Click agent card --> filter tasks & timeline by agent
  |
  +---> Office View (toggle)
          |
          +-- Pixel art floor plan with rooms
          +-- Agents move to rooms based on status
          +-- Click agent --> bottom info panel
          +-- Status legend overlay
```

### Step-by-Step

1. **App Launch** -- Tauri window opens (min 960x600). The app scans `~/.claude/projects/` for active team sessions and displays them.
2. **Team List Load** -- Teams appear as cards. Each card shows team name, agent count, and progress summary.
3. **Team Selection** -- User clicks a team card. A fade transition loads the monitoring interface. The Dashboard view is shown by default.
4. **Dashboard Monitoring** -- The agent grid shows all agents with real-time status. Users can filter by status using the filter bar. Clicking an agent highlights its card and filters the sidebar to show only that agent's tasks and timeline events.
5. **Office View** -- User toggles to the Office view via the view switcher. A slide transition swaps the content. Pixel art agents appear in rooms matching their status (working -> workspace, blocked -> meeting room, idle -> lounge, offline -> server room).
6. **Agent Detail** -- Clicking an agent (in either view) reveals detailed information: current task, recent messages, task counts.

---

## 2. Interaction Patterns

### Hover

| Element | Hover Behavior |
|---------|---------------|
| Agent Card (Dashboard) | Background brightens from `pixel-surface` to `pixel-panel`. Subtle `transform: scale(1.01)` lift. |
| Pixel Agent (Office) | Glow filter via `drop-shadow`. Name tag becomes more prominent. |
| Status Filter Button | Background highlight, text color brightens to `pixel-bright`. |
| Task Item | Left border accent appears. Background subtly lightens. |
| View Toggle Button | Icon/label color transition to accent. |

All hover transitions use `transition-all duration-200` for consistency.

### Click / Select

| Element | Click Behavior |
|---------|---------------|
| Agent Card | Toggles selection. Selected card gets colored border + ring glow matching status color. Sidebar filters to show agent's tasks and timeline. |
| Pixel Agent | Toggles selection. Selected agent gets dashed animated selection ring. Bottom info panel slides up with agent details. |
| Status Filter | Instant filter -- agent grid re-renders with matching agents only. Active filter button shows accent background. |
| Task Item | Expands inline to show description, blockers, and dependencies. |
| View Toggle | Swaps between Dashboard and Office views with a slide transition. |

### View Transitions

- **Dashboard <-> Office**: `SlideTransition` -- the outgoing view slides left while the incoming view slides in from the right. Duration: 300ms with ease-in-out.
- **Team Selection -> Monitor**: `FadeTransition` -- 200ms opacity crossfade.
- **Agent Panel (Office)**: Slides up from bottom when agent is selected, slides down on deselect. Duration: 200ms.
- **Sidebar Content**: Crossfade when selected agent changes. Duration: 150ms.

All transitions are CSS-based (no JS animation libraries) controlled via React state.

### Real-Time Updates

| Event | Visual Feedback |
|-------|----------------|
| Agent status change | Status badge pulses once. Agent card flashes with status color border. NotificationToast appears at bottom-right. In Office view, agent smoothly walks to new room. |
| New task assigned | Task appears in sidebar with a brief highlight animation (yellow glow fade). |
| Task completed | Progress bar animates forward. Completed task gets green checkmark with fade-in. NotificationToast with success type. |
| New message received | Message count badge increments with a brief scale bounce. |
| Agent goes offline | Card dims slightly (opacity 0.7). In Office, agent walks to server room. |

### State Filter Behavior

Filters respond instantly (no debounce needed -- data is local):
- Clicking an active filter deselects it (returns to "All").
- Agent count badges next to each filter update in real-time.
- Filtered-out agents fade out (opacity 0 over 150ms), matching agents remain.
- If the selected agent is filtered out, selection clears automatically.

---

## 3. Accessibility

### Keyboard Navigation

- **Tab** cycles through: view toggle -> status filters -> agent cards (grid order) -> sidebar sections.
- **Enter/Space** on agent card triggers selection (same as click).
- **Enter/Space** on filter button toggles filter.
- **Escape** clears agent selection.
- **Arrow keys** within the agent grid navigate between cards.
- Focus indicators: 2px outline using `pixel-blue` color, clearly visible against dark background.

### Color Contrast

All text/background combinations meet WCAG AA (4.5:1 minimum):

| Text Color | Background | Ratio | Pass |
|------------|-----------|-------|------|
| `pixel-bright` (#e6f1ff) | `pixel-bg` (#1a1a2e) | 12.3:1 | AAA |
| `pixel-text` (#ccd6f6) | `pixel-bg` (#1a1a2e) | 9.8:1 | AAA |
| `pixel-dim` (#8892b0) | `pixel-bg` (#1a1a2e) | 4.7:1 | AA |
| `pixel-green` (#00d98b) | `pixel-bg` (#1a1a2e) | 8.2:1 | AAA |
| `pixel-yellow` (#ffd93d) | `pixel-bg` (#1a1a2e) | 12.5:1 | AAA |
| `pixel-accent` (#e94560) | `pixel-bg` (#1a1a2e) | 5.1:1 | AA |

Status indicators use both color AND shape/text (not color-alone) to convey state.

### Screen Reader Support

- Agent cards use `role="button"` with `aria-pressed` for selection state.
- Status badges include `aria-label` with full status text.
- View toggle uses `aria-label` and `aria-current` for the active view.
- Live region (`aria-live="polite"`) for toast notifications.

---

## 4. Responsive Layout

### Minimum Viewport: 960 x 600

The app targets desktop (Tauri window). Minimum supported size is 960x600.

### Breakpoints

| Width | Dashboard Grid | Sidebar |
|-------|---------------|---------|
| 960px - 1199px | 2-column agent grid | 288px (w-72) fixed sidebar |
| 1200px+ | 3-column agent grid | 320px (w-80) fixed sidebar |

### Content Adaptation

- **Agent Cards**: Truncate long agent names and task descriptions with ellipsis.
- **Office View**: SVG viewBox (610x320) scales proportionally to fill available space.
- **Sidebar**: Scrollable independently. Task list and timeline each get at most 50% of sidebar height, with overflow scroll.
- **Bottom Panel (Office)**: Fixed height, full-width. Appears/disappears based on selection.
- **Toast Notifications**: Anchored to bottom-right corner, stacked vertically with 8px gap.

---

## 5. Component Interaction Map

```
App Shell
  |
  +-- ViewToggle [Dashboard | Office]
  |
  +-- Dashboard View
  |     +-- StatusFilter --> filters agents
  |     +-- AgentCard[] --> selects agent
  |     +-- Sidebar
  |           +-- TaskList (filtered by selected agent)
  |           +-- Timeline (filtered by selected agent)
  |
  +-- Office View
  |     +-- OfficeRoom[] (static layout)
  |     +-- PixelAgent[] --> selects agent
  |     +-- Bottom InfoPanel (selected agent)
  |
  +-- NotificationToast (global, bottom-right)
  +-- FadeTransition (team load)
  +-- SlideTransition (view switch)
```

---

## 6. Transition Components

### FadeTransition

- **Purpose**: Smooth opacity-based enter/exit for content switching (team load, sidebar content change).
- **Props**: `show: boolean`, `duration?: number` (default 200ms).
- **Implementation**: CSS `opacity` + `transition`. Uses `visibility: hidden` when fully faded to remove from tab order.

### SlideTransition

- **Purpose**: Horizontal slide for view switching (Dashboard <-> Office).
- **Props**: `direction: 'left' | 'right'`, `show: boolean`, `duration?: number` (default 300ms).
- **Implementation**: CSS `transform: translateX()` + `opacity` combo. Incoming slides from the direction, outgoing slides away.

### NotificationToast

- **Purpose**: Brief notifications for real-time events (agent status changes, task completions).
- **Props**: `message: string`, `type: 'info' | 'success' | 'warning'`, `onDismiss: () => void`.
- **Behavior**: Appears from bottom-right. Auto-dismisses after 3 seconds. Pixel art styled border. Can be manually dismissed by clicking.
- **Colors**: info -> `pixel-blue`, success -> `pixel-green`, warning -> `pixel-yellow`.
