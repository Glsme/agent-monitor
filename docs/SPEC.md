# Agent Monitor - Feature Specification

## 1. Project Overview

**Agent Monitor** is a macOS desktop application that provides a real-time GUI for monitoring Claude Code Agent teams. It visualizes agent states, tasks, messages, and team activity through two complementary views: a data-rich Dashboard and a playful pixel-art Office.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Tauri v2 (Rust backend + WebView frontend) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS (custom pixel-art design tokens) |
| State | React hooks + Tauri event system |
| FS Watch | `notify` crate (v7) via Rust |
| Build | Vite + tauri-build |
| Target | macOS (Darwin, arm64/x86_64) |

### Architecture Diagram

```
~/.claude/                        Tauri App
  teams/{name}/config.json   -->  +-----------------------+
  teams/{name}/inboxes/*.json     | Rust Backend          |
  tasks/{name}/*.json             |  - FS read (std::fs)  |
                                  |  - notify watcher     |
         FS events                |  - JSON -> structs    |
            |                     +----------+------------+
            v                                |
     RecommendedWatcher                      | Tauri Commands / Events
            |                                v
            +------->  app.emit("team-update", snapshot)
                                             |
                                             v
                                  +-----------------------+
                                  | React Frontend        |
                                  |  - useTeamData hook   |
                                  |  - Dashboard view     |
                                  |  - Office view        |
                                  +-----------------------+
```

---

## 2. MVP Feature Requirements

### 2.1 Dashboard View

The Dashboard is the primary data view. It displays all agents and tasks in a structured layout.

#### 2.1.1 Header Stats Bar
- Team name and description
- Total agent count
- Task completion ratio (e.g. "5/12 tasks")

#### 2.1.2 Global Progress Bar
- Horizontal stacked bar showing pending / in_progress / completed task ratios
- Color-coded: gray (pending), yellow (in_progress), green (completed)

#### 2.1.3 Status Filter Bar
- Filter buttons: All | Working | Idle | Blocked | Offline
- Each button shows count of agents in that state
- Active filter is highlighted with status color

#### 2.1.4 Agent Cards (Main Grid)
- Responsive grid: 1 / 2 / 3 columns based on viewport
- Each card contains:
  - **Pixel-art avatar** with agent color (derived from name/type)
  - **Status indicator** (colored dot, pulses when "working")
  - **Name** and **agent type**
  - **Current task** display (activeForm or subject)
  - **Per-agent progress bar** (pending / in_progress / completed)
  - **Message count** badge
- Clicking a card selects the agent and filters the sidebar

#### 2.1.5 Task List (Right Sidebar)
- Shows all tasks or filtered by selected agent
- Each row: status icon (circle variants), task ID, subject, owner (@name), blocked badge
- Status icons: `○` pending, `◎` in_progress, `●` completed
- Completed tasks shown with strikethrough

#### 2.1.6 Timeline (Right Sidebar)
- Reverse-chronological event stream
- Event types with icons:
  - `task_started` (play icon, green)
  - `task_completed` (check icon, green)
  - `message_sent` (diamond icon, blue)
  - `status_change` (dot icon, yellow)
- Relative timestamps: "just now", "3m ago", "2h ago"
- Filters by selected agent when one is active

### 2.2 Office View

The Office View is a pixel-art visualization where agents are represented as characters moving between rooms based on their status.

#### 2.2.1 Office Layout
Six rooms arranged in a 3x2-like grid (SVG viewBox `610x320`):

| Room | Type | Purpose | Position |
|------|------|---------|----------|
| WORKSPACE A | workspace | Working agents | Top-left |
| WORKSPACE B | workspace | Working agents | Top-center |
| SERVER ROOM | server | Offline agents | Top-right |
| MEETING ROOM | meeting | Blocked agents | Bottom-left |
| LOUNGE | lounge | Idle agents | Bottom-center |
| WORKSPACE C | workspace | Working agents | Bottom-right |

Rooms are connected by hallway corridors (rendered as semi-transparent lines).

#### 2.2.2 Room Visuals
Each room type has distinct furniture rendered in pixel art:
- **Workspace**: Desks with colored monitor screens
- **Meeting**: Central table with whiteboard
- **Lounge**: Couch, coffee table, potted plant
- **Server**: Server racks with blinking LED lights

Active rooms (containing working agents) have a pulsing green border glow.

#### 2.2.3 Pixel Agent Characters
- 16px-scale characters with head, body, arms, legs
- Color derived from agent name/type using `AGENT_COLORS` map
- **Animations**:
  - Walking: alternating leg/arm rotation when moving between rooms
  - Idle bounce: sine-wave vertical oscillation for working agents
  - Eye blink: periodic frame where eyes close
  - Status LED: colored circle at top-right, pulses for "working"
- **Speech bubble**: shows `activeForm` text (truncated to 16 chars) when agent has active task
- **Name tag**: dark rounded rectangle below character
- **Selection ring**: dashed animated border when clicked

#### 2.2.4 Agent Placement Logic
- Agents are assigned to rooms based on status:
  - `working` -> Workspace A/B/C (distributed via name hash)
  - `blocked` -> Meeting Room
  - `idle` -> Lounge
  - `offline` -> Server Room
- Within a room, agents are arranged in a grid pattern with padding

#### 2.2.5 Bottom Info Panel
- Shown when an agent is selected
- Displays: name, status badge, agent type, task counts, current task, latest message

#### 2.2.6 Legends
- **Status legend** (bottom-left): colored dots for working/idle/blocked/offline
- **Team label** (top-right): team name in pixel font

### 2.3 Team Selection

- Supports multiple teams under `~/.claude/teams/`
- `list_teams` command scans for directories containing `config.json`
- Team selector UI allows switching between teams
- Switching team triggers `get_team_snapshot` and `watch_team` for the new team

### 2.4 Real-Time Updates

Two mechanisms for live data:

#### 2.4.1 File System Watching (Primary)
- `watch_team` command spawns a background thread with `notify::RecommendedWatcher`
- Watches `~/.claude/teams/{name}/` and `~/.claude/tasks/{name}/` recursively
- On any file change: debounce 200ms, then re-read full snapshot and emit `team-update` event
- React frontend listens via `@tauri-apps/api/event`

#### 2.4.2 Polling (Fallback)
- 3-second interval polling via `setInterval` calling `get_team_snapshot`
- Active in both Tauri and browser-mock modes
- Ensures updates are not missed if watcher fails

---

## 3. Data Sources

All data is read from the local filesystem under `~/.claude/`.

### 3.1 Team Configuration
**Path**: `~/.claude/teams/{team-name}/config.json`

Contains the team definition: name, description, and member list.

```json
{
  "team_name": "my-project",
  "description": "Feature development team",
  "members": [
    { "name": "team-lead", "agentId": "lead-001", "agentType": "general-purpose" },
    { "name": "developer", "agentId": "dev-002", "agentType": "ios-swift-developer" }
  ]
}
```

### 3.2 Task Data
**Path**: `~/.claude/tasks/{team-name}/{id}.json`

One JSON file per task. Files are read and sorted by ID.

```json
{
  "id": "3",
  "subject": "Implement core data models",
  "description": "Create TypeScript interfaces and Rust structs",
  "status": "in_progress",
  "owner": "developer",
  "activeForm": "Implementing models",
  "blockedBy": [],
  "blocks": ["5"],
  "createdAt": "2026-02-11T10:00:00Z",
  "updatedAt": "2026-02-11T10:30:00Z"
}
```

### 3.3 Agent Inbox Messages
**Path**: `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`

Supports three formats (tried in order):
1. JSON array of messages
2. Single JSON message object
3. NDJSON (newline-delimited JSON)

Only the most recent 20 messages are loaded (reverse chronological).

```json
[
  {
    "from": "team-lead",
    "to": "developer",
    "content": "Please start on the API endpoints",
    "type": "message",
    "timestamp": "2026-02-11T10:15:00Z",
    "summary": "Start API work"
  }
]
```

---

## 4. Tauri Command API

### 4.1 `list_teams`

Lists all available team names.

```
Command:  list_teams
Params:   (none)
Returns:  Result<Vec<String>, String>
```

**Logic**: Scans `~/.claude/teams/`, returns directory names that contain a `config.json` file.

**Frontend usage**:
```typescript
const teams = await invoke<string[]>("list_teams");
```

### 4.2 `get_team_snapshot`

Returns a complete snapshot of a team's current state.

```
Command:  get_team_snapshot
Params:   team_name: String
Returns:  Result<TeamSnapshot, String>
```

**Logic**:
1. Read `config.json` for the team
2. Read all task JSON files from `~/.claude/tasks/{team_name}/`
3. For each member in config:
   - Filter tasks by `owner`
   - Determine status: has `in_progress` task -> "working", has blocked tasks -> "blocked", else "idle"
   - Count tasks by status (pending / in_progress / completed)
   - Read inbox messages (up to 20, most recent first)
4. Build timeline from task updates and messages, sorted by timestamp (newest first), capped at 100 events

**Frontend usage**:
```typescript
const snapshot = await invoke<TeamSnapshot>("get_team_snapshot", { teamName: "my-team" });
```

### 4.3 `watch_team`

Starts a background file system watcher for a team. Emits `team-update` events on changes.

```
Command:  watch_team
Params:   team_name: String, app: AppHandle (injected)
Returns:  Result<(), String>
```

**Logic**:
1. Spawns a new OS thread
2. Creates a `RecommendedWatcher` (from `notify` crate)
3. Watches `~/.claude/teams/{team_name}/` and `~/.claude/tasks/{team_name}/` recursively
4. On any filesystem event:
   - Debounce: wait 200ms, drain additional events
   - Call `get_team_snapshot` to rebuild the full snapshot
   - Emit `team-update` event via `app.emit()`

**Frontend usage**:
```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<TeamSnapshot>("team-update", (event) => {
  setSnapshot(event.payload);
});

await invoke("watch_team", { teamName: "my-team" });
```

---

## 5. State Management Flow

```
                     FS Change Detected
                            |
                            v
~/.claude/{files}  --->  notify::Watcher (Rust thread)
                            |
                      200ms debounce
                            |
                            v
                     get_team_snapshot()
                      - read config.json
                      - read tasks/*.json
                      - read inboxes/*.json
                      - compute agent states
                      - build timeline
                            |
                            v
                     app.emit("team-update", TeamSnapshot)
                            |
                            v
            @tauri-apps/api/event listener (React)
                            |
                            v
                     setSnapshot(payload)
                            |
                            v
              React re-render (Dashboard / Office)
```

### Hook: `useTeamData(teamName?)`

Central data hook that manages all state:

| State | Type | Purpose |
|-------|------|---------|
| `snapshot` | `TeamSnapshot \| null` | Current team state |
| `teams` | `string[]` | Available team names |
| `loading` | `boolean` | Initial load indicator |
| `error` | `string \| null` | Error message |

**Initialization flow**:
1. On mount: call `list_teams` to populate team selector
2. When `teamName` changes: call `get_team_snapshot` for initial data
3. Set up Tauri event listener for `team-update`
4. Call `watch_team` to start FS watcher
5. Start 3s polling interval as fallback

**Browser development mode**: When `window.__TAURI_INTERNALS__` is not present, the hook returns mock data with 5 demo agents for UI development without Tauri runtime.

---

## 6. View Modes

The app supports two view modes, togglable via the UI:

| Mode | Type | Component |
|------|------|-----------|
| `dashboard` | Data-focused | `<Dashboard snapshot={...} />` |
| `office` | Visual / fun | `<OfficeView snapshot={...} />` |

Both views receive the same `TeamSnapshot` prop and are purely presentational.

---

## 7. Design Tokens

The UI uses a pixel-art themed design system with custom Tailwind tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `pixel-bg` | Dark background | App background |
| `pixel-surface` | Slightly lighter | Card backgrounds |
| `pixel-panel` | Panel borders | Borders, dividers |
| `pixel-bright` | `#e6f1ff` | Primary text |
| `pixel-text` | Muted bright | Body text |
| `pixel-dim` | `#8892b0` | Secondary text |
| `pixel-green` | `#00d98b` | Working / completed |
| `pixel-yellow` | `#ffd93d` | In-progress / warnings |
| `pixel-blue` | `#4fc3f7` | Messages / links |
| `pixel-accent` | `#e94560` | Blocked / errors |

Fonts: `"Press Start 2P"` for pixel headings, `"JetBrains Mono"` for monospace content.

---

## 8. Window Configuration

Defined in `tauri.conf.json`:

| Property | Value |
|----------|-------|
| Title | Agent Monitor |
| Default size | 1280 x 800 |
| Minimum size | 960 x 600 |
| Decorations | Native window chrome |
| FS scope | `$HOME/.claude/**` (read-only) |

---

## 9. Non-Goals (MVP)

The following are explicitly out of scope for the MVP:

- Sending messages or commands to agents (read-only monitor)
- Editing tasks from the GUI
- Multi-window support
- Windows/Linux platform support
- Authentication or encryption
- Remote/network team monitoring
- Historical data persistence or analytics
- Plugin system
