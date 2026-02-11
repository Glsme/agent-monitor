# QA Plan - Agent Monitor

> Claude Code Agent Team GUI Tool
> Version: 0.1.0
> Date: 2026-02-11

---

## 1. Test Strategy Overview

### 1.1 Objectives
- Validate all frontend components render correctly and handle edge cases
- Verify Tauri backend commands return well-formed data and handle filesystem errors gracefully
- Confirm real-time data flow (file watcher -> Tauri event -> React state -> UI update)
- Ensure the application performs well with varying team sizes (1-50 agents)
- Validate both Dashboard and Office pixel-art views function correctly

### 1.2 Test Pyramid

| Level | Coverage Target | Tools |
|---|---|---|
| Unit Tests | 80%+ line coverage | Vitest + React Testing Library |
| Integration Tests | Key data flows | Vitest + MSW (mock Tauri IPC) |
| E2E Tests | Critical user paths | Playwright / Tauri Driver |
| Visual Regression | Key components | Playwright screenshot comparison |
| Performance | Benchmarks met | Lighthouse, React Profiler, `perf_hooks` |

### 1.3 Test Environment
- **Browser mode**: Mock data via `createMockSnapshot()` (no Tauri runtime required)
- **Tauri dev mode**: Real filesystem reads from `~/.claude/teams/` and `~/.claude/tasks/`
- **CI**: Headless browser tests with mocked Tauri IPC layer

---

## 2. Unit Test Plan

### 2.1 Types & Constants (`src/types/agent.ts`)

| Test Case | Description |
|---|---|
| UT-T01 | AGENT_COLORS contains valid hex color strings for all defined keys |
| UT-T02 | STATUS_COLORS maps all 4 statuses (idle, working, blocked, offline) |
| UT-T03 | STATUS_LABELS maps all 4 statuses to human-readable labels |
| UT-T04 | TypeScript compilation succeeds with all interface definitions |

### 2.2 StatusBadge (`src/components/common/StatusBadge.tsx`)

| Test Case | Description |
|---|---|
| UT-SB01 | Renders correct label text for each known status (idle, working, blocked, offline) |
| UT-SB02 | Applies correct color from STATUS_COLORS for each status |
| UT-SB03 | Shows `animate-pulse` class only when status is "working" |
| UT-SB04 | Renders correct dot size for `size="sm"` vs `size="md"` |
| UT-SB05 | Falls back to `STATUS_COLORS.offline` for unknown status strings |
| UT-SB06 | Falls back to raw status string as label for unknown status |

### 2.3 ProgressBar (`src/components/common/ProgressBar.tsx`)

| Test Case | Description |
|---|---|
| UT-PB01 | Returns null when total (pending + inProgress + completed) is 0 |
| UT-PB02 | Displays correct "X/Y done" text |
| UT-PB03 | Calculates correct percentage for completed portion |
| UT-PB04 | Green bar width matches completed percentage |
| UT-PB05 | Yellow bar width matches in-progress percentage |
| UT-PB06 | Handles case where all tasks are completed (100%) |
| UT-PB07 | Handles case where no tasks are completed (0%) |
| UT-PB08 | Percentage rounds correctly (no decimal display) |

### 2.4 AgentCard (`src/components/dashboard/AgentCard.tsx`)

| Test Case | Description |
|---|---|
| UT-AC01 | Renders agent name, status badge, and progress bar |
| UT-AC02 | Displays current task activeForm when agent has a current_task |
| UT-AC03 | Shows "Waiting for tasks..." when status is idle and no current_task |
| UT-AC04 | Shows message count when recent_messages is non-empty |
| UT-AC05 | Applies selected styling (border color, ring, box-shadow) when selected=true |
| UT-AC06 | Calls onClick handler when card is clicked |
| UT-AC07 | `getAgentColor` returns matching color from AGENT_COLORS when key is found |
| UT-AC08 | `getAgentColor` generates stable hash-based color for unknown agent types |
| UT-AC09 | Displays agent_type when provided |
| UT-AC10 | Truncates long agent names and task descriptions via CSS truncate |
| UT-AC11 | SVG pixel avatar renders with correct color |

### 2.5 Dashboard (`src/components/dashboard/Dashboard.tsx`)

| Test Case | Description |
|---|---|
| UT-D01 | Renders team name and description from snapshot |
| UT-D02 | Displays correct agent count |
| UT-D03 | Displays correct "completed/total tasks" stat |
| UT-D04 | Global ProgressBar receives correct taskStats |
| UT-D05 | Status filter shows correct counts per status |
| UT-D06 | Filtering agents by status works correctly for each status value |
| UT-D07 | "all" filter shows every agent |
| UT-D08 | Selecting an agent shows agent-specific tasks in sidebar |
| UT-D09 | Deselecting an agent shows all tasks in sidebar |
| UT-D10 | Timeline filters by selected agent when an agent is selected |
| UT-D11 | Shows "No agents match filter" when filter has zero results |

### 2.6 StatusFilter (`src/components/dashboard/StatusFilter.tsx`)

| Test Case | Description |
|---|---|
| UT-SF01 | Renders all 5 filter buttons (all, working, idle, blocked, offline) |
| UT-SF02 | Active filter button has distinct styling (border, background) |
| UT-SF03 | Count for "all" is sum of all agent counts |
| UT-SF04 | Count displays 0 for statuses with no agents |
| UT-SF05 | Calls onChange with correct filter value on click |

### 2.7 Timeline (`src/components/dashboard/Timeline.tsx`)

| Test Case | Description |
|---|---|
| UT-TL01 | Renders correct icon and color for each event_type |
| UT-TL02 | `formatTimestamp` returns "just now" for <60s ago |
| UT-TL03 | `formatTimestamp` returns "Xm ago" for <1h ago |
| UT-TL04 | `formatTimestamp` returns "Xh ago" for <24h ago |
| UT-TL05 | `formatTimestamp` returns date string for >24h ago |
| UT-TL06 | `formatTimestamp` returns raw string for invalid date |
| UT-TL07 | Respects maxItems prop (defaults to 50) |
| UT-TL08 | Shows "No events yet..." when events array is empty |
| UT-TL09 | Timeline connector line renders between items (not after last) |

### 2.8 TaskList (`src/components/dashboard/TaskList.tsx`)

| Test Case | Description |
|---|---|
| UT-TK01 | Renders all tasks with correct id, subject, and status icon |
| UT-TK02 | Completed tasks have strikethrough and dim text |
| UT-TK03 | Shows owner with @ prefix when owner exists |
| UT-TK04 | Shows "blocked" label when task has non-empty blockedBy |
| UT-TK05 | Shows "No tasks" when tasks array is empty |
| UT-TK06 | Status icon matches: pending="circle", in_progress="target", completed="filled" |

### 2.9 PixelAgent (`src/components/office/PixelAgent.tsx`)

| Test Case | Description |
|---|---|
| UT-PA01 | Renders SVG group at correct initial position |
| UT-PA02 | Moving animation triggers when targetX/targetY differ from current pos |
| UT-PA03 | Walking legs animate when isMoving is true |
| UT-PA04 | Idle legs render as static rectangles |
| UT-PA05 | Eye blink occurs on frame === 3 |
| UT-PA06 | Status indicator circle uses correct status color |
| UT-PA07 | Working status indicator has opacity animation |
| UT-PA08 | Speech bubble displays when agent has current_task and is not moving |
| UT-PA09 | Speech bubble text truncates at 16 characters with "..." |
| UT-PA10 | Selection ring with dash animation renders when selected=true |
| UT-PA11 | Name tag width scales with agent name length |
| UT-PA12 | onClick fires when agent is clicked |
| UT-PA13 | `cancelAnimationFrame` is called on cleanup |

### 2.10 OfficeRoom (`src/components/office/OfficeRoom.tsx`)

| Test Case | Description |
|---|---|
| UT-OR01 | Renders room with correct position and dimensions |
| UT-OR02 | Room colors correspond to room type (workspace, meeting, lounge, server) |
| UT-OR03 | Floor tile pattern renders correct number of tiles based on width/height |
| UT-OR04 | Active room glow animation renders when isActive=true |
| UT-OR05 | Room label text is centered |
| UT-OR06 | WorkspaceFurniture renders desks and monitors |
| UT-OR07 | MeetingFurniture renders table and whiteboard |
| UT-OR08 | LoungeFurniture renders couch, plant, and coffee table |
| UT-OR09 | ServerFurniture renders racks with blinking lights |

### 2.11 OfficeView (`src/components/office/OfficeView.tsx`)

| Test Case | Description |
|---|---|
| UT-OV01 | All 6 rooms are rendered |
| UT-OV02 | Agents are assigned to rooms based on status (working->workspace, blocked->meeting, idle->lounge, offline->server) |
| UT-OV03 | Agent positions distribute evenly within a room |
| UT-OV04 | Selected agent shows detail panel at bottom |
| UT-OV05 | Legend shows all 4 status colors |
| UT-OV06 | Room legend shows team name |
| UT-OV07 | Clicking an agent toggles selection |
| UT-OV08 | Selected agent detail shows task count and current task |
| UT-OV09 | Recent message preview shows in agent detail panel |

### 2.12 useTeamData Hook (`src/hooks/useTeamData.ts`)

| Test Case | Description |
|---|---|
| UT-TD01 | Returns mock data when not in Tauri environment |
| UT-TD02 | Sets loading=false after initial data load |
| UT-TD03 | Sets error state on Tauri invoke failure |
| UT-TD04 | Clears error on successful load after previous error |
| UT-TD05 | Polling interval is set to 3000ms |
| UT-TD06 | Polling interval is cleaned up on unmount |
| UT-TD07 | `loadTeams` returns ["demo-team"] in mock mode |
| UT-TD08 | `refresh` function triggers manual data reload |
| UT-TD09 | Tauri event listener is registered for "team-update" |
| UT-TD10 | Tauri event listener unlisten is called on cleanup |

### 2.13 Rust Backend (`src-tauri/src/lib.rs`)

| Test Case | Description |
|---|---|
| UT-R01 | `list_teams` returns empty vec when teams directory does not exist |
| UT-R02 | `list_teams` returns only directories that contain config.json |
| UT-R03 | `get_team_snapshot` returns error when config.json is missing |
| UT-R04 | `get_team_snapshot` correctly parses team config with all fields |
| UT-R05 | `read_tasks` handles empty tasks directory |
| UT-R06 | `read_tasks` skips non-JSON files |
| UT-R07 | `read_tasks` silently skips malformed JSON files |
| UT-R08 | `read_tasks` sorts tasks by id |
| UT-R09 | `read_inbox` handles JSON array format |
| UT-R10 | `read_inbox` handles single JSON object format |
| UT-R11 | `read_inbox` handles NDJSON (newline-delimited JSON) format |
| UT-R12 | `read_inbox` returns max 20 most recent messages |
| UT-R13 | `read_inbox` returns empty vec when file does not exist |
| UT-R14 | Agent status is "working" when has in_progress task |
| UT-R15 | Agent status is "blocked" when has tasks with non-empty blockedBy |
| UT-R16 | Agent status is "idle" when no in_progress tasks and no blocked tasks |
| UT-R17 | `build_timeline` generates events from tasks and messages |
| UT-R18 | `build_timeline` sorts events by timestamp descending |
| UT-R19 | `build_timeline` truncates to 100 events |
| UT-R20 | `watch_team` creates filesystem watcher for team and tasks directories |
| UT-R21 | Watcher debounces events (200ms drain period) |

---

## 3. Integration Test Scenarios

### 3.1 Data Flow: Backend -> Frontend

| Test Case | Description |
|---|---|
| IT-DF01 | Tauri `get_team_snapshot` result deserializes into TypeScript TeamSnapshot interface |
| IT-DF02 | File changes in `~/.claude/teams/` trigger "team-update" event within 3s |
| IT-DF03 | File changes in `~/.claude/tasks/` trigger "team-update" event within 3s |
| IT-DF04 | New task file creation appears in the snapshot on next poll/event |
| IT-DF05 | Task status change is reflected in agent status and task list |
| IT-DF06 | New inbox message appears in agent recent_messages |

### 3.2 View Switching & State

| Test Case | Description |
|---|---|
| IT-VS01 | Switching from Dashboard to Office view preserves team data |
| IT-VS02 | Agent selection state resets on view switch |
| IT-VS03 | Switching teams triggers new data load and clears previous state |

### 3.3 Filter & Selection

| Test Case | Description |
|---|---|
| IT-FS01 | Selecting a status filter updates agent grid and preserves selection if agent matches |
| IT-FS02 | Selecting a filter that excludes currently selected agent clears selection |
| IT-FS03 | Agent selection in Dashboard filters TaskList and Timeline simultaneously |
| IT-FS04 | Counts in StatusFilter update in real-time when agent status changes |

### 3.4 Real-time Updates

| Test Case | Description |
|---|---|
| IT-RT01 | Dashboard updates within 3s when a task file is modified on disk |
| IT-RT02 | Office view moves agent to correct room when status changes |
| IT-RT03 | Timeline event appears when task transitions to completed |
| IT-RT04 | ProgressBar updates when task counts change |
| IT-RT05 | Mock mode polling updates every 3 seconds |

---

## 4. E2E Test Scenarios

### 4.1 Application Startup

| Test Case | Description |
|---|---|
| E2E-01 | Application launches and displays team selection or default team |
| E2E-02 | Dashboard view loads with all agents visible |
| E2E-03 | Office view loads with all rooms and agents rendered |

### 4.2 Dashboard User Flows

| Test Case | Description |
|---|---|
| E2E-10 | User clicks agent card -> task list and timeline filter by agent |
| E2E-11 | User clicks agent card again -> deselects, shows all tasks/timeline |
| E2E-12 | User clicks "Working" filter -> only working agents shown |
| E2E-13 | User clicks "All" filter -> all agents shown again |
| E2E-14 | Scrolling works in agent grid when there are many agents |
| E2E-15 | Scrolling works in task list and timeline panels |

### 4.3 Office View User Flows

| Test Case | Description |
|---|---|
| E2E-20 | Working agents are in workspace rooms |
| E2E-21 | Blocked agents are in meeting room |
| E2E-22 | Idle agents are in lounge |
| E2E-23 | User clicks agent -> info panel appears at bottom |
| E2E-24 | User clicks selected agent -> info panel disappears |
| E2E-25 | Speech bubbles show for agents with active tasks |

### 4.4 Responsive Layout

| Test Case | Description |
|---|---|
| E2E-30 | Window at minimum size (960x600) renders without overflow or clipping |
| E2E-31 | Window at 1920x1080 uses full space with proper grid layout |
| E2E-32 | Dashboard grid switches from 1-col to 2-col to 3-col at breakpoints |

---

## 5. Performance Benchmarks

### 5.1 Rendering Performance

| Metric | Target | Tool |
|---|---|---|
| Initial render (Dashboard) | < 200ms | React Profiler |
| Initial render (Office SVG) | < 300ms | React Profiler |
| Re-render on snapshot update | < 100ms | React Profiler |
| Animation frame rate (Office) | >= 30 FPS | Performance API |
| Agent movement animation | Smooth 60 FPS | requestAnimationFrame timing |

### 5.2 Data & Memory

| Metric | Target | Tool |
|---|---|---|
| Memory usage (5 agents) | < 50 MB | Chrome DevTools / Task Manager |
| Memory usage (20 agents) | < 80 MB | Chrome DevTools / Task Manager |
| Memory usage (50 agents) | < 150 MB | Chrome DevTools / Task Manager |
| No memory growth over 10 min idle | Stable +/- 5 MB | Heap snapshot comparison |
| JSON parse (100 tasks) | < 50ms | `performance.now()` |

### 5.3 Backend Performance

| Metric | Target | Tool |
|---|---|---|
| `list_teams` response | < 50ms | Tauri IPC timing |
| `get_team_snapshot` (5 agents, 20 tasks) | < 100ms | Tauri IPC timing |
| `get_team_snapshot` (20 agents, 100 tasks) | < 500ms | Tauri IPC timing |
| File watcher debounce latency | < 500ms after last change | Event timing |
| Polling overhead (3s interval) | < 1% CPU idle | Activity Monitor |

### 5.4 SVG Rendering (Office View)

| Metric | Target | Tool |
|---|---|---|
| SVG DOM node count (5 agents) | < 500 nodes | DOM inspection |
| SVG DOM node count (20 agents) | < 2000 nodes | DOM inspection |
| OfficeRoom tile rendering (6 rooms) | < 50ms | React Profiler |

---

## 6. Edge Cases

### 6.1 Data Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-D01 | Empty team (0 agents) | Dashboard shows "No agents match filter", Office shows empty rooms |
| EC-D02 | Agent with no tasks at all | Shows idle status with 0/0 progress, "Waiting for tasks..." |
| EC-D03 | Agent with 100+ tasks | ProgressBar renders correctly, no overflow |
| EC-D04 | Task with extremely long subject (500+ chars) | Text truncated with CSS `truncate` |
| EC-D05 | Agent name with special characters (spaces, unicode) | Renders correctly, no XSS, filename encoding works |
| EC-D06 | Task with empty blockedBy array `[]` | Not marked as blocked (correctly checks `!b.is_empty()`) |
| EC-D07 | Task with null/undefined optional fields | Graceful handling, no undefined errors |
| EC-D08 | Inbox file with mixed valid/invalid JSON lines (NDJSON) | Valid lines parsed, invalid silently skipped |
| EC-D09 | Team config with no description field | Description area hidden, no errors |
| EC-D10 | Timestamp in unexpected format | `formatTimestamp` returns raw string |
| EC-D11 | All agents in same status | All in one filter, single room in Office packed correctly |
| EC-D12 | Agent with in_progress task AND blocked tasks | Status should be "working" (in_progress takes priority in Rust) |
| EC-D13 | Multiple agents with same name | Potential key collision in React lists |
| EC-D14 | Task owned by agent not in team config | Task appears in all_tasks but not in any agent's filtered tasks |

### 6.2 Filesystem Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-F01 | `~/.claude/teams/` directory does not exist | `list_teams` returns empty array |
| EC-F02 | `~/.claude/tasks/<team>/` directory does not exist | `read_tasks` returns empty array |
| EC-F03 | Team directory exists but config.json is missing | Not listed in `list_teams` |
| EC-F04 | config.json contains malformed JSON | `get_team_snapshot` returns error |
| EC-F05 | Task JSON file with invalid schema | Silently skipped (no error propagation) |
| EC-F06 | Inbox file is empty (0 bytes) | Returns empty messages array |
| EC-F07 | Filesystem permission denied on read | Error propagated via `map_err` |
| EC-F08 | File modified during read (race condition) | Watcher debounce handles, retry on next poll |
| EC-F09 | Watched directory deleted during runtime | Watcher may error; thread continues looping |
| EC-F10 | HOME environment variable not set | Falls back to `/tmp` |
| EC-F11 | Very large inbox file (10000+ messages) | Only last 20 returned (`.rev().take(20)`) |

### 6.3 UI Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-U01 | Rapid filter switching | No state corruption, correct filtering |
| EC-U02 | Click agent while data is loading | No crash, selection applied after load |
| EC-U03 | Window resize during Office animation | SVG viewBox scales, no overflow |
| EC-U04 | Very long team name | Truncated or ellipsis in header |
| EC-U05 | 50 agents in Office view | All agents visible, rooms not overcrowded beyond usability |
| EC-U06 | 0 timeline events | Shows "No events yet..." message |
| EC-U07 | All tasks completed | Progress bar shows 100%, green only |
| EC-U08 | Agent name length 1 character | Name tag width calculation still works |
| EC-U09 | Agent name length 30+ characters | Name tag doesn't overflow room boundaries |
| EC-U10 | Theme consistency | All pixel-* colors used consistently |

### 6.4 Network/Runtime Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-R01 | Tauri IPC call fails | Error state set, user sees error message |
| EC-R02 | Running in browser without Tauri | Mock mode activates, demo data shown |
| EC-R03 | Multiple `watch_team` calls for same team | Multiple watchers created (potential issue - see CODE_REVIEW) |
| EC-R04 | Application backgrounded for extended period | Polling resumes on foreground, data refreshed |

---

## 7. Test Implementation Priority

### Phase 1 - Critical (Week 1)
1. Unit tests for `useTeamData` hook (data layer foundation)
2. Unit tests for Rust backend commands (`list_teams`, `get_team_snapshot`)
3. Integration test for data flow (Backend -> Hook -> Component)
4. E2E test for application startup

### Phase 2 - Core UI (Week 2)
1. Unit tests for all common components (StatusBadge, ProgressBar)
2. Unit tests for Dashboard and its sub-components
3. Unit tests for AgentCard with all state variations
4. E2E tests for Dashboard user flows

### Phase 3 - Office View (Week 3)
1. Unit tests for PixelAgent animation logic
2. Unit tests for OfficeRoom rendering
3. Unit tests for OfficeView agent positioning
4. E2E tests for Office view user flows

### Phase 4 - Polish (Week 4)
1. Performance benchmarks
2. Edge case validation
3. Visual regression tests
4. Memory leak testing

---

## 8. Test Infrastructure Requirements

### 8.1 Dependencies to Add

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0",
    "@playwright/test": "^1.48.0"
  }
}
```

### 8.2 Vitest Configuration

A `vitest.config.ts` should be created with:
- jsdom environment for React component tests
- Path alias resolution matching `vite.config.ts` (`@` -> `./src`)
- Coverage thresholds: statements 80%, branches 75%, functions 80%, lines 80%
- Setup file for Tauri IPC mocking

### 8.3 Rust Test Setup

- Cargo test with temporary directories for filesystem operations
- Mock `HOME` environment variable for isolated testing
- Test fixtures: sample config.json, task JSON files, inbox files

---

## 9. Quality Gates

| Gate | Criteria | When |
|---|---|---|
| PR Merge | All unit tests pass, no new lint errors | Every PR |
| Release Candidate | All integration + E2E tests pass | Before release |
| Performance | All benchmarks within targets | Before release |
| Coverage | >= 80% line coverage on new code | Every PR |
| No Critical Bugs | Zero open critical/major bugs | Before release |
