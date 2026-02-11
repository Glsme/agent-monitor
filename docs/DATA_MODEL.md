# Agent Monitor - Data Model Design

## 1. Overview

This document defines the data models used across the Rust backend and React frontend. Both layers share equivalent structures, serialized as JSON for IPC via Tauri commands and events.

---

## 2. TypeScript Type Definitions

> Source: `src/types/agent.ts`

### 2.1 Core Data Types

#### TeamMember
Represents a team member as declared in `config.json`.

```typescript
interface TeamMember {
  name: string;        // Unique identifier within the team (e.g. "developer")
  agentId: string;     // Claude agent ID (e.g. "dev-002")
  agentType?: string;  // Agent specialization (e.g. "ios-swift-developer", "Explore")
}
```

#### TaskData
A single task with status, ownership, and dependency info.

```typescript
interface TaskData {
  id: string;                                    // Unique task ID (numeric string)
  subject: string;                               // Task title / summary
  description?: string;                          // Detailed task description
  status: "pending" | "in_progress" | "completed";  // Current lifecycle state
  owner?: string;                                // Agent name who owns this task
  activeForm?: string;                           // Present-tense activity label (e.g. "Implementing models")
  blockedBy?: string[];                          // Task IDs that block this task
  blocks?: string[];                             // Task IDs that this task blocks
  createdAt?: string;                            // ISO 8601 timestamp
  updatedAt?: string;                            // ISO 8601 timestamp (last modification)
}
```

#### InboxMessage
A message in an agent's inbox.

```typescript
interface InboxMessage {
  from?: string;       // Sender agent name
  to?: string;         // Recipient agent name
  content?: string;    // Full message text
  msg_type?: string;   // Message type (e.g. "message", "broadcast", "shutdown_request")
  timestamp?: string;  // ISO 8601 timestamp
  summary?: string;    // Short summary for display
}
```

#### TaskCount
Aggregated task counts per agent.

```typescript
interface TaskCount {
  pending: number;
  in_progress: number;
  completed: number;
}
```

#### AgentState
Computed runtime state of a single agent. This is NOT stored on disk -- it is derived by the backend from task and inbox data.

```typescript
interface AgentState {
  name: string;                        // From TeamMember.name
  agent_id: string;                    // From TeamMember.agentId
  agent_type?: string;                 // From TeamMember.agentType
  status: "idle" | "working" | "blocked" | "offline";  // Computed status
  current_task?: TaskData;             // First in_progress task owned by this agent
  recent_messages: InboxMessage[];     // Last 20 inbox messages (newest first)
  task_count: TaskCount;               // Aggregated counts of owned tasks
}
```

#### TimelineEvent
A single event in the team activity timeline. Derived from tasks and messages.

```typescript
interface TimelineEvent {
  timestamp: string;       // ISO 8601
  agent: string;           // Agent name associated with this event
  event_type:              // Category of event
    | "task_started"       // Task moved to in_progress
    | "task_completed"     // Task moved to completed
    | "message_sent"       // Inbox message recorded
    | "status_change";     // Other status transitions
  description: string;     // Human-readable description
}
```

#### TeamSnapshot
Complete point-in-time snapshot of an entire team. This is the primary data structure passed from backend to frontend.

```typescript
interface TeamSnapshot {
  team_name: string;              // From TeamConfig.team_name
  description?: string;           // From TeamConfig.description
  agents: AgentState[];           // Computed state for each team member
  all_tasks: TaskData[];          // All tasks (sorted by ID)
  timeline: TimelineEvent[];      // Recent events (sorted newest-first, max 100)
}
```

### 2.2 UI Types

```typescript
type ViewMode = "dashboard" | "office";
type StatusFilter = "all" | "idle" | "working" | "blocked" | "offline";

// Pixel art visual configuration for office view
interface AgentVisual {
  color: string;      // Hex color for the agent character
  icon: string;       // Reserved for future icon system
  roomIndex: number;  // Which room the agent is placed in
}
```

### 2.3 Constants

#### Agent Colors
Maps agent roles/types to colors for visual identification.

```typescript
const AGENT_COLORS: Record<string, string> = {
  planner:       "#ffd93d",  // Yellow
  researcher:    "#4fc3f7",  // Light blue
  developer:     "#00d98b",  // Green
  "ui-designer": "#b388ff",  // Purple
  "ux-designer": "#ff80ab",  // Pink
  tester:        "#ffab40",  // Orange
  reviewer:      "#e94560",  // Red
  default:       "#8892b0",  // Gray
};
```

Color resolution: check if agent's `agentType` or `name` (lowercased) contains any key from this map. If no match, generate a stable color by hashing the agent name and indexing into the color array.

#### Status Colors
Maps agent statuses to display colors.

```typescript
const STATUS_COLORS: Record<string, string> = {
  idle:    "#8892b0",  // Gray
  working: "#00d98b",  // Green
  blocked: "#e94560",  // Red
  offline: "#4a4a5e",  // Dark gray
};
```

#### Status Labels
Human-readable labels for status values.

```typescript
const STATUS_LABELS: Record<string, string> = {
  idle:    "Idle",
  working: "Working",
  blocked: "Blocked",
  offline: "Offline",
};
```

---

## 3. Rust Backend Structs

> Source: `src-tauri/src/lib.rs`

The Rust structs mirror the TypeScript types with `serde` for JSON serialization. Key differences:
- Uses `Option<T>` instead of optional fields
- Uses `String` for enum-like fields (status, event_type)
- Uses `#[serde(rename = "...")]` for camelCase JSON field names

### 3.1 TeamConfig (Backend Only)
```rust
struct TeamConfig {
    team_name: String,
    members: Vec<TeamMember>,
    description: Option<String>,
}
```
This struct is only used in the backend for deserializing `config.json`. It is not exposed to the frontend directly -- its data flows into `TeamSnapshot`.

### 3.2 Field Name Mapping

| Rust field | JSON / TypeScript field |
|-----------|------------------------|
| `agent_id` | `agentId` |
| `agent_type` | `agentType` |
| `active_form` | `activeForm` |
| `blocked_by` | `blockedBy` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `msg_type` | `type` |

---

## 4. JSON File Schemas

### 4.1 Team Config (`config.json`)

```json
{
  "team_name": "agent-monitor-dev",
  "description": "Agent Monitor development team",
  "members": [
    {
      "name": "team-lead",
      "agentId": "lead-abc123",
      "agentType": "general-purpose"
    },
    {
      "name": "planner",
      "agentId": "plan-def456",
      "agentType": "planner"
    },
    {
      "name": "developer",
      "agentId": "dev-ghi789"
    }
  ]
}
```

**Constraints**:
- `team_name`: required, used as display name
- `members`: required, non-empty array
- `members[].name`: required, unique within team, used as key for task ownership and inbox files
- `members[].agentId`: required, Claude agent identifier
- `members[].agentType`: optional, used for color mapping and display

### 4.2 Task File (`{id}.json`)

```json
{
  "id": "5",
  "subject": "Write integration tests",
  "description": "Create end-to-end tests for the API layer including error cases",
  "status": "in_progress",
  "owner": "tester",
  "activeForm": "Writing tests",
  "blockedBy": ["3"],
  "blocks": [],
  "createdAt": "2026-02-11T09:00:00.000Z",
  "updatedAt": "2026-02-11T10:45:00.000Z"
}
```

**Constraints**:
- `id`: required, unique within team, matches filename stem
- `subject`: required, human-readable title
- `status`: required, one of `"pending"`, `"in_progress"`, `"completed"`
- `owner`: optional, must match a `TeamMember.name` if set
- `activeForm`: optional, present-continuous description shown during in_progress
- `blockedBy`: optional, array of task IDs; if non-empty, task is considered blocked
- `blocks`: optional, array of task IDs that depend on this task
- Timestamps: optional, ISO 8601 format

### 4.3 Inbox File (`{agent-name}.json`)

**Format A: JSON Array** (preferred)
```json
[
  {
    "from": "team-lead",
    "to": "developer",
    "content": "Please implement the auth module next",
    "type": "message",
    "timestamp": "2026-02-11T10:00:00.000Z",
    "summary": "Implement auth module"
  },
  {
    "from": "tester",
    "to": "developer",
    "content": "Found a bug in the login flow",
    "type": "message",
    "timestamp": "2026-02-11T10:30:00.000Z",
    "summary": "Login bug report"
  }
]
```

**Format B: Single Object**
```json
{
  "from": "team-lead",
  "to": "developer",
  "content": "Welcome to the team",
  "type": "message",
  "timestamp": "2026-02-11T09:00:00.000Z",
  "summary": "Welcome message"
}
```

**Format C: NDJSON (Newline-Delimited JSON)**
```
{"from":"team-lead","to":"developer","content":"Start coding","type":"message","timestamp":"2026-02-11T09:00:00Z","summary":"Start"}
{"from":"tester","to":"developer","content":"Tests pass","type":"message","timestamp":"2026-02-11T10:00:00Z","summary":"Tests OK"}
```

**Parsing priority**: Array -> Single Object -> NDJSON. First successful parse wins.

**Constraints**:
- All fields are optional (graceful degradation)
- Only the most recent 20 messages are loaded
- Messages are returned in reverse chronological order (newest first)

---

## 5. Agent Status State Machine

Agent status is **computed**, not stored. The backend derives it from task data each time a snapshot is built.

### 5.1 State Diagram

```
                    ┌─────────────┐
                    │   offline   │  (default if agent process not detected)
                    └──────┬──────┘
                           │ agent joins / data appears
                           v
                    ┌─────────────┐
            ┌──────>│    idle     │<──────┐
            │       └──────┬──────┘       │
            │              │              │
            │   has in_progress task      │  all tasks completed
            │              │              │  or no owned tasks
            │              v              │
            │       ┌─────────────┐       │
            │       │   working   │───────┘
            │       └──────┬──────┘
            │              │
            │   owned task has non-empty blockedBy
            │              │
            │              v
            │       ┌─────────────┐
            └───────│   blocked   │
                    └─────────────┘
                           │
                    blocker resolved
                    (blockedBy becomes empty)
                           │
                           v
                    back to idle or working
```

### 5.2 Status Derivation Logic

The status is determined in the following priority order (from `get_team_snapshot`):

```
1. If agent has ANY task with status == "in_progress"
   AND that task's owner == agent.name
   => status = "working"

2. Else if agent has ANY owned task where blockedBy is non-empty
   => status = "blocked"

3. Else
   => status = "idle"
```

> Note: `"offline"` is not currently derived from data. It is reserved for future implementation (e.g., process heartbeat detection). Currently, all agents in the config are treated as at least "idle".

### 5.3 State-to-Room Mapping (Office View)

| Status | Room(s) | Visual Meaning |
|--------|---------|---------------|
| `working` | Workspace A, B, or C | Actively coding at desk |
| `blocked` | Meeting Room | Discussing blockers |
| `idle` | Lounge | Resting, waiting for tasks |
| `offline` | Server Room | Powered down / disconnected |

Working agents are distributed across workspace rooms using a hash of the agent name modulo 3.

---

## 6. TeamSnapshot Structure Detail

`TeamSnapshot` is the single data object that drives the entire UI. It is rebuilt on every FS change.

### 6.1 Build Process

```
Input:
  config.json   ->  TeamConfig { team_name, description, members[] }
  tasks/*.json  ->  Vec<TaskData>
  inboxes/*.json -> Vec<InboxMessage> per agent

Processing:
  For each member in config.members:
    1. Filter all_tasks where task.owner == member.name  =>  owned_tasks
    2. Find first owned task with status "in_progress"   =>  current_task
    3. Compute status (working / blocked / idle)
    4. Count owned tasks by status                       =>  task_count
    5. Read inbox file for member.name                   =>  recent_messages (max 20)
    6. Build AgentState

  Build timeline:
    For each task with updatedAt:
      Create event (task_started | task_completed | status_change)
    For each agent's recent_messages with timestamp:
      Create event (message_sent)
    Sort by timestamp descending
    Truncate to 100 events

Output:
  TeamSnapshot {
    team_name,
    description,
    agents: AgentState[],
    all_tasks: TaskData[],
    timeline: TimelineEvent[]
  }
```

### 6.2 Data Flow Diagram

```
config.json ──────────┐
                       │
tasks/*.json ──────────┼──> get_team_snapshot() ──> TeamSnapshot
                       │         │                       │
inboxes/*.json ────────┘         │                       │
                                 │                  emit("team-update")
                           build_timeline()              │
                           read_tasks()                  v
                           read_inbox()            React setState
                                                         │
                                              ┌──────────┴──────────┐
                                              v                     v
                                         Dashboard            OfficeView
```

### 6.3 Example Full Snapshot

```json
{
  "team_name": "agent-monitor-dev",
  "description": "Agent Monitor development team",
  "agents": [
    {
      "name": "team-lead",
      "agent_id": "lead-001",
      "agent_type": "general-purpose",
      "status": "working",
      "current_task": {
        "id": "1",
        "subject": "Coordinate team implementation",
        "status": "in_progress",
        "owner": "team-lead",
        "activeForm": "Coordinating team",
        "updatedAt": "2026-02-11T10:30:00Z"
      },
      "recent_messages": [
        {
          "from": "developer",
          "to": "team-lead",
          "content": "Backend API ready for review",
          "type": "message",
          "timestamp": "2026-02-11T10:25:00Z",
          "summary": "API ready"
        }
      ],
      "task_count": {
        "pending": 1,
        "in_progress": 1,
        "completed": 2
      }
    },
    {
      "name": "developer",
      "agent_id": "dev-002",
      "agent_type": "ios-swift-developer",
      "status": "idle",
      "current_task": null,
      "recent_messages": [],
      "task_count": {
        "pending": 0,
        "in_progress": 0,
        "completed": 3
      }
    }
  ],
  "all_tasks": [
    {
      "id": "1",
      "subject": "Coordinate team implementation",
      "status": "in_progress",
      "owner": "team-lead",
      "activeForm": "Coordinating team",
      "createdAt": "2026-02-11T09:00:00Z",
      "updatedAt": "2026-02-11T10:30:00Z"
    },
    {
      "id": "2",
      "subject": "Set up project structure",
      "status": "completed",
      "owner": "developer",
      "createdAt": "2026-02-11T09:05:00Z",
      "updatedAt": "2026-02-11T09:45:00Z"
    }
  ],
  "timeline": [
    {
      "timestamp": "2026-02-11T10:30:00Z",
      "agent": "team-lead",
      "event_type": "task_started",
      "description": "[in_progress] Coordinate team implementation"
    },
    {
      "timestamp": "2026-02-11T10:25:00Z",
      "agent": "developer",
      "event_type": "message_sent",
      "description": "API ready"
    },
    {
      "timestamp": "2026-02-11T09:45:00Z",
      "agent": "developer",
      "event_type": "task_completed",
      "description": "[completed] Set up project structure"
    }
  ]
}
```

---

## 7. Relationship Diagram

```
TeamConfig (config.json)
  ├── team_name ──────────────────────> TeamSnapshot.team_name
  ├── description ────────────────────> TeamSnapshot.description
  └── members[] ──────────────────────> used to build AgentState[]
        ├── name ─────────────────────> AgentState.name
        │     └── matches ────────────> TaskData.owner
        │     └── matches ────────────> InboxMessage filename
        ├── agentId ──────────────────> AgentState.agent_id
        └── agentType ────────────────> AgentState.agent_type

TaskData (tasks/{id}.json)
  ├── status ─────────────────────────> determines AgentState.status
  ├── owner ──────────────────────────> links to AgentState.name
  ├── blockedBy[] ────────────────────> task dependency chain
  ├── blocks[] ───────────────────────> reverse dependency
  └── updatedAt ──────────────────────> used in TimelineEvent.timestamp

InboxMessage (inboxes/{name}.json)
  ├── from ───────────────────────────> TimelineEvent.agent
  ├── timestamp ──────────────────────> TimelineEvent.timestamp
  └── summary|content ────────────────> TimelineEvent.description
```
