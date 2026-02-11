# Code Review - Agent Monitor

> Reviewed: 2026-02-11
> Scope: All existing source files (Rust backend + React frontend)

---

## 1. Code Review Summary

### Overall Assessment
The codebase demonstrates solid architecture with clean separation between Tauri backend and React frontend. The pixel-art UI design is well-implemented with consistent styling. However, there are several issues ranging from potential memory leaks to type safety gaps and missing error boundaries that need to be addressed before production readiness.

### Statistics
- **Critical**: 3
- **Major**: 8
- **Minor**: 11

---

## 2. Issues Found

### CRITICAL Issues

---

#### CR-001: OfficeView forces re-render every 100ms causing excessive CPU usage

- **File**: `src/components/office/OfficeView.tsx`
- **Lines**: 83-87
- **Severity**: Critical
- **Category**: Performance / Memory

**Description**:
```tsx
useEffect(() => {
  const interval = setInterval(() => setTime(Date.now()), 100);
  return () => clearInterval(interval);
}, []);
```

The `time` state is updated every 100ms (10 times per second) to "force re-render for animations." This causes the entire OfficeView component tree (including all PixelAgent and OfficeRoom components) to re-render 10 times per second, even when nothing has changed. The `time` variable is never even used in the render output -- it only exists to trigger re-renders.

**Impact**: High CPU usage, excessive re-renders (600/minute), battery drain on laptops.

**Fix**: Remove this interval entirely. The PixelAgent component already manages its own animations via `requestAnimationFrame` and `setInterval` for walking frames. The idle bounce (`Math.sin(Date.now() / 300)`) in PixelAgent should be moved to its own internal animation loop. If periodic re-renders are needed, use a much longer interval (e.g., 1000ms) or use CSS animations instead.

---

#### CR-002: PixelAgent movement animation uses stale closure over `pos` state

- **File**: `src/components/office/PixelAgent.tsx`
- **Lines**: 37-74
- **Severity**: Critical
- **Category**: Bug

**Description**:
```tsx
useEffect(() => {
  const dx = targetX - pos.x;  // pos is captured from render closure
  const dy = targetY - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    setIsMoving(false);
    setPos({ x: targetX, y: targetY });
    return;
  }
  // ...
}, [targetX, targetY]); // dependency array missing `pos`
```

The effect depends on `pos.x` and `pos.y` to compute distance, but `pos` is not in the dependency array. This means:
1. The initial distance check uses a stale `pos` value from a previous render.
2. The `setPos` functional updater inside `animate` is correct (it uses `prev`), but the outer distance/moving-state checks may be wrong.

Additionally, if `targetX`/`targetY` don't change (which is the current pattern in OfficeView -- they're always equal to x/y initial position), this effect only runs once at mount. This means agents never actually animate movement.

**Impact**: Agent movement animation may not work correctly. Including `pos` in deps would cause an infinite re-render loop.

**Fix**: Refactor to use a `useRef` for position tracking within the animation loop, and only use React state for the final rendered position. Or, compute distance inside the `requestAnimationFrame` callback using the functional updater pattern.

---

#### CR-003: `watch_team` spawns threads that never terminate

- **File**: `src-tauri/src/lib.rs`
- **Lines**: 288-336
- **Severity**: Critical
- **Category**: Memory Leak / Resource Leak

**Description**:
```rust
std::thread::spawn(move || {
    // ...
    loop {
        if rx.recv_timeout(Duration::from_secs(2)).is_ok() {
            // ...
        }
    }
});
```

Each call to `watch_team` spawns a new thread with an infinite loop. There is no mechanism to:
1. Stop the watcher thread when the team changes
2. Stop the watcher thread when the window closes
3. Prevent duplicate watchers for the same team

If the frontend calls `watch_team` multiple times (e.g., team switch, page reload), orphaned threads accumulate.

**Impact**: Thread leak, file descriptor leak (watcher handles), increasing CPU usage over time.

**Fix**: Use a `Mutex<HashMap<String, JoinHandle>>` to track watchers, stop existing watcher before creating a new one. Implement a `stop_watch` command or use Tauri's lifecycle events to clean up on window close. Consider using a cancellation token pattern.

---

### MAJOR Issues

---

#### CR-004: CSP (Content Security Policy) is disabled

- **File**: `src-tauri/tauri.conf.json`
- **Lines**: 22-24
- **Severity**: Major
- **Category**: Security

**Description**:
```json
"security": {
  "csp": null
}
```

Setting CSP to null disables all content security policy protections. While convenient for development, this allows arbitrary script execution, inline styles, and potentially XSS attacks if any user-controlled data is rendered without sanitization.

**Impact**: If any agent name, task subject, or message content contains malicious script, it could execute in the Tauri webview context.

**Fix**: Define a proper CSP that allows necessary resources:
```json
"csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; script-src 'self'"
```

---

#### CR-005: Missing App.tsx and main.tsx entry points

- **File**: `src/` directory
- **Lines**: N/A
- **Severity**: Major
- **Category**: Missing Implementation

**Description**: The project has all components but is missing the application entry points (`src/main.tsx` and `src/App.tsx`). Without these, the application cannot render. The `vite.config.ts` and `tauri.conf.json` are configured to expect a working frontend at port 1420, but there is no entry point to bootstrap React.

**Impact**: Application will not start. This is likely in-progress work, but it blocks all manual testing.

**Fix**: Create `src/main.tsx` (ReactDOM.createRoot) and `src/App.tsx` (routing between Dashboard and OfficeView, team selection, useTeamData integration).

---

#### CR-006: Duplicated `getAgentColor` function

- **File**: `src/components/dashboard/AgentCard.tsx` lines 11-23, `src/components/office/PixelAgent.tsx` lines 14-25
- **Lines**: AgentCard.tsx:11-23, PixelAgent.tsx:14-25
- **Severity**: Major
- **Category**: Code Duplication

**Description**: The `getAgentColor` function is copy-pasted identically in both `AgentCard.tsx` and `PixelAgent.tsx`. Both perform the same AGENT_COLORS lookup and hash-based fallback.

**Impact**: Maintenance burden -- changes to color logic must be made in two places. Risk of divergence.

**Fix**: Extract to a shared utility, e.g., `src/utils/agentUtils.ts`.

---

#### CR-007: OfficeView `activeRooms` computation is inefficient and fragile

- **File**: `src/components/office/OfficeView.tsx`
- **Lines**: 116-123
- **Severity**: Major
- **Category**: Bug / Performance

**Description**:
```tsx
const activeRooms = useMemo(() => {
  const active = new Set<number>();
  for (const pos of Object.values(agentPositions)) {
    const agent = snapshot.agents.find(a =>
      a.name === Object.keys(agentPositions).find(k => agentPositions[k] === pos)
    );
    if (agent?.status === "working") active.add(pos.room);
  }
  return active;
}, [agentPositions, snapshot.agents]);
```

This uses object reference equality (`agentPositions[k] === pos`) to reverse-lookup the agent name from a position. Since `agentPositions` is computed by `useMemo`, the inner objects are created fresh each time, but within a single render cycle the references are stable. However, this is a confusing O(n^2) pattern.

**Impact**: Unnecessarily complex code, O(n^2) lookups, fragile if multiple agents share a position object (they don't currently, but could).

**Fix**: Simplify to iterate over `snapshot.agents` directly:
```tsx
const activeRooms = useMemo(() => {
  const active = new Set<number>();
  for (const agent of snapshot.agents) {
    if (agent.status === "working") {
      const pos = agentPositions[agent.name];
      if (pos) active.add(pos.room);
    }
  }
  return active;
}, [agentPositions, snapshot.agents]);
```

---

#### CR-008: Rust `dirs_next()` function name is misleading

- **File**: `src-tauri/src/lib.rs`
- **Lines**: 86-94
- **Severity**: Major
- **Category**: Code Quality

**Description**:
```rust
fn get_claude_dir() -> PathBuf {
    dirs_next().join(".claude")
}

fn dirs_next() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}
```

The function `dirs_next()` is named after the `dirs-next` crate but doesn't actually use it. It manually reads `HOME` env var and falls back to `/tmp`. This is misleading and platform-specific (won't work on Windows where HOME may not be set).

**Impact**: Confusing to maintain. Will fail silently on Windows (falls back to `/tmp` which doesn't exist). The `Cargo.toml` doesn't include `dirs-next` as a dependency even though the function suggests it should.

**Fix**: Either use the actual `dirs-next` crate (`dirs_next::home_dir()`) or rename the function to `get_home_dir()` with clear documentation about the fallback behavior. Consider supporting Windows via `USERPROFILE`.

---

#### CR-009: `read_tasks` silently swallows all parse errors

- **File**: `src-tauri/src/lib.rs`
- **Lines**: 209-218
- **Severity**: Major
- **Category**: Error Handling

**Description**:
```rust
for entry in entries.flatten() {
    let path = entry.path();
    if path.extension().map(|e| e == "json").unwrap_or(false) {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(task) = serde_json::from_str::<TaskData>(&data) {
                tasks.push(task);
            }
        }
    }
}
```

Both the file read and JSON parse errors are silently ignored. If a task file becomes corrupted or has schema changes, it will simply disappear from the UI with no indication to the user.

**Impact**: Data silently missing from the UI. Debugging filesystem issues becomes difficult.

**Fix**: Log warnings for parse failures using `eprintln!` or Tauri's logging plugin. Optionally include a `warnings` field in the snapshot response.

---

#### CR-010: `tokio` dependency is unused

- **File**: `src-tauri/Cargo.toml`
- **Lines**: 21
- **Severity**: Major
- **Category**: Build / Dependencies

**Description**:
```toml
tokio = { version = "1", features = ["full"] }
```

The `tokio` crate with `features = ["full"]` is included but never used in `lib.rs`. The code uses `std::thread::spawn` for the watcher, not async/await. Including `tokio` with full features adds significant compile time and binary size.

**Impact**: Unnecessary ~2-3 MB added to binary, longer compile times.

**Fix**: Remove `tokio` from dependencies, or if async is planned for future use, add a comment and reduce features to only what's needed.

---

#### CR-011: `glob` dependency is unused

- **File**: `src-tauri/Cargo.toml`
- **Lines**: 22
- **Severity**: Major
- **Category**: Build / Dependencies

**Description**:
```toml
glob = "0.3"
```

The `glob` crate is included but never used anywhere in the Rust code.

**Impact**: Unnecessary dependency, adds compile time.

**Fix**: Remove from `Cargo.toml`.

---

### MINOR Issues

---

#### CR-012: `ProgressBar` passes `taskStats` using spread with wrong property name

- **File**: `src/components/dashboard/Dashboard.tsx`
- **Lines**: 78-79
- **Severity**: Minor
- **Category**: Type Safety

**Description**:
```tsx
const taskStats = useMemo(() => {
  return {
    pending: ...,
    in_progress: ..., // snake_case
    completed: ...,
  };
}, [snapshot.all_tasks]);

<ProgressBar {...taskStats} />
```

`ProgressBar` expects `inProgress` (camelCase) but `taskStats` computes `in_progress` (snake_case). The spread operator will pass `in_progress` which doesn't match the prop name `inProgress`.

**Impact**: ProgressBar will always receive `inProgress = undefined`, showing 0% in-progress. TypeScript should catch this if strict checking is enabled.

**Fix**: Change `taskStats` to use `inProgress` instead of `in_progress`:
```tsx
const taskStats = useMemo(() => ({
  pending: tasks.filter(t => t.status === "pending").length,
  inProgress: tasks.filter(t => t.status === "in_progress").length,
  completed: tasks.filter(t => t.status === "completed").length,
}), [snapshot.all_tasks]);
```

---

#### CR-013: Missing `index.html` verification

- **File**: Project root
- **Lines**: N/A
- **Severity**: Minor
- **Category**: Missing File

**Description**: The `tauri.conf.json` expects a built frontend at `../dist` and the dev server at port 1420. The existence and correctness of `index.html` (with the React root div and Vite script tag) was not verified.

**Fix**: Ensure `index.html` exists in the project root with proper `<div id="root">` and `<script type="module" src="/src/main.tsx">`.

---

#### CR-014: No error boundary for React components

- **File**: `src/components/` (all)
- **Lines**: N/A
- **Severity**: Minor
- **Category**: Error Handling

**Description**: There are no React Error Boundary components. If any component throws during render (e.g., due to unexpected data shape), the entire application will white-screen.

**Fix**: Add an Error Boundary wrapper around main views (Dashboard, OfficeView) that catches render errors and displays a fallback UI.

---

#### CR-015: `useTeamData` polling continues in Tauri mode alongside event listener

- **File**: `src/hooks/useTeamData.ts`
- **Lines**: 178-185
- **Severity**: Minor
- **Category**: Performance

**Description**: The polling interval (every 3000ms) runs unconditionally, even when the Tauri file watcher is active and sending real-time events. This creates redundant data fetching in Tauri mode.

**Impact**: Unnecessary IPC calls every 3 seconds, redundant re-renders when watcher is already providing updates.

**Fix**: Disable polling when the Tauri watcher is successfully set up:
```tsx
useEffect(() => {
  loadSnapshot();
  if (!isTauri()) {
    intervalRef.current = setInterval(loadSnapshot, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }
}, [loadSnapshot]);
```

---

#### CR-016: Timeline key may not be unique

- **File**: `src/components/dashboard/Timeline.tsx`
- **Lines**: 47
- **Severity**: Minor
- **Category**: React Best Practice

**Description**:
```tsx
key={`${event.timestamp}-${i}`}
```

While using index as part of the key is acceptable for a static list, the timeline events can change order on re-render (events are sorted by timestamp). If the list changes between renders, React may not correctly reconcile elements.

**Impact**: Potential UI flicker or incorrect event rendering after data updates.

**Fix**: Use a more stable unique identifier if available, or accept the current approach as sufficient for read-only sorted lists.

---

#### CR-017: PixelAgent name tag width calculation is approximate

- **File**: `src/components/office/PixelAgent.tsx`
- **Lines**: 152-155
- **Severity**: Minor
- **Category**: UI

**Description**:
```tsx
<rect
  x={-(agent.name.length * 3 + 4)}
  y="-1"
  width={agent.name.length * 6 + 8}
  height="10"
```

The name tag background width assumes each character is 6px wide. With the monospace font at 7px size, this is approximate and may clip longer names or leave excess space for short names.

**Impact**: Visual imperfection -- name tag may slightly misalign with text.

**Fix**: Minor visual issue. Could use SVG `<text>` with `getBBox()` for precise sizing, but the current approach is acceptable for pixel-art aesthetic.

---

#### CR-018: Missing `aria` attributes for accessibility

- **File**: All interactive components
- **Lines**: Various
- **Severity**: Minor
- **Category**: Accessibility

**Description**: Interactive elements like `AgentCard` (uses `div` with `onClick`), `StatusFilter` buttons, and SVG `PixelAgent` (uses `g` with `onClick`) lack proper ARIA attributes. The `AgentCard` uses a `div` as a clickable element without `role="button"`, `tabIndex`, or keyboard event handlers.

**Impact**: Screen readers cannot identify interactive elements. Keyboard-only users cannot navigate.

**Fix**: Add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space), and `aria-label` to interactive elements. Use `<button>` instead of `<div>` where possible.

---

#### CR-019: `InboxMessage` TypeScript type uses `msg_type` (snake_case)

- **File**: `src/types/agent.ts`
- **Lines**: 23
- **Severity**: Minor
- **Category**: Naming Convention

**Description**:
```typescript
export interface InboxMessage {
  msg_type?: string;  // snake_case, inconsistent with TS convention
```

Most fields in TypeScript interfaces use camelCase, but `msg_type` uses snake_case. This matches the Rust serde rename (`#[serde(rename = "type")]`), but the Rust struct uses `msg_type` as the field name while the JSON key is `type`. The TypeScript side should use `type` (matching JSON) or consistently use camelCase with a note.

**Impact**: Minor inconsistency. Could cause confusion when accessing the field.

**Fix**: Rename to `msgType` in TypeScript, or add a comment explaining the naming.

---

#### CR-020: `read_inbox` reverses then takes 20, losing chronological order

- **File**: `src-tauri/src/lib.rs`
- **Lines**: 233, 242
- **Severity**: Minor
- **Category**: Data Logic

**Description**:
```rust
Ok(messages.into_iter().rev().take(20).collect())
```

This reverses the messages and takes the first 20, which gives the 20 most recent messages in reverse chronological order. The frontend displays them but doesn't re-sort. If the caller expects chronological order, this would be wrong.

**Impact**: Messages may display in reverse order. Currently the frontend only shows count and first message, so impact is limited.

**Fix**: Document the ordering behavior. If chronological order is needed, add `.rev()` after `.take(20)` or sort in the frontend.

---

#### CR-021: No loading or error UI states defined

- **File**: `src/hooks/useTeamData.ts`, components
- **Lines**: Various
- **Severity**: Minor
- **Category**: UX

**Description**: The `useTeamData` hook exposes `loading` and `error` states, but no component currently consumes them. There are no loading skeletons, spinners, or error message displays.

**Impact**: Users see a blank screen while data is loading or when an error occurs.

**Fix**: Create a loading state component (skeleton/spinner) and an error display component, rendered in the main App based on `loading` and `error` from `useTeamData`.

---

#### CR-022: `read_tasks` uses `&PathBuf` instead of `&Path`

- **File**: `src-tauri/src/lib.rs`
- **Lines**: 202, 223
- **Severity**: Minor
- **Category**: Rust Idiom

**Description**:
```rust
fn read_tasks(tasks_dir: &PathBuf) -> Result<Vec<TaskData>, String> {
fn read_inbox(inboxes_dir: &PathBuf, agent_name: &str) -> Result<Vec<InboxMessage>, String> {
```

Rust convention is to accept `&Path` rather than `&PathBuf` for read-only path parameters, as `&PathBuf` auto-derefs to `&Path` and the function doesn't need ownership.

**Impact**: No functional impact, but violates Rust API guidelines (Clippy lint `clippy::ptr_arg`).

**Fix**: Change parameter types to `&std::path::Path`.

---

## 3. Type Safety Verification

### 3.1 TypeScript-Rust Interface Alignment

| Field | Rust (serde) | TypeScript | Match |
|---|---|---|---|
| TeamMember.agentId | `#[serde(rename = "agentId")]` | `agentId: string` | OK |
| TeamMember.agentType | `#[serde(rename = "agentType")]` | `agentType?: string` | OK |
| TaskData.activeForm | `#[serde(rename = "activeForm")]` | `activeForm?: string` | OK |
| TaskData.blockedBy | `#[serde(rename = "blockedBy")]` | `blockedBy?: string[]` | OK |
| TaskData.createdAt | `#[serde(rename = "createdAt")]` | `createdAt?: string` | OK |
| TaskData.updatedAt | `#[serde(rename = "updatedAt")]` | `updatedAt?: string` | OK |
| InboxMessage.type | `#[serde(rename = "type")]` -> `msg_type` | `msg_type?: string` | MISMATCH - JSON key is "type" but TS field is "msg_type" |
| AgentState.agent_id | No rename | `agent_id: string` | OK (both snake_case in JSON) |
| AgentState.agent_type | No rename | `agent_type?: string` | OK |
| AgentState.current_task | No rename | `current_task?: TaskData` | OK |
| AgentState.recent_messages | No rename | `recent_messages: InboxMessage[]` | OK |
| AgentState.task_count | No rename | `task_count: TaskCount` | OK |

**Issue Found**: `InboxMessage.msg_type` -- The Rust struct serializes the field as `"type"` (due to `#[serde(rename = "type")]`), but the TypeScript interface uses `msg_type`. When receiving the JSON payload, `msg_type` will be `undefined` and the actual value will be in a field called `type` (which is a reserved word in some contexts but valid as a property name). This means the frontend never correctly reads the message type.

### 3.2 Strict TypeScript Gaps

- `AgentState.status` in Rust is a `String` (any value), but in TypeScript it's a union type `"idle" | "working" | "blocked" | "offline"`. If Rust returns an unexpected status, TypeScript won't catch it at runtime.
- `TaskData.status` has similar narrowing: Rust is `String`, TypeScript is `"pending" | "in_progress" | "completed"`.
- `TimelineEvent.event_type` Rust is `String`, TypeScript is a 4-value union.

---

## 4. Memory Leak Analysis

### 4.1 setInterval

| Location | Cleanup | Status |
|---|---|---|
| `useTeamData.ts:181` - 3000ms polling | `clearInterval` in cleanup | OK |
| `OfficeView.tsx:85` - 100ms re-render | `clearInterval` in cleanup | OK (but should be removed - see CR-001) |
| `PixelAgent.tsx:79-82` - 200ms walk animation | `clearInterval` in cleanup | OK |

### 4.2 addEventListener / Event Listeners

| Location | Cleanup | Status |
|---|---|---|
| `useTeamData.ts:163` - Tauri "team-update" listener | `unlisten()` in cleanup | OK |

### 4.3 requestAnimationFrame

| Location | Cleanup | Status |
|---|---|---|
| `PixelAgent.tsx:67-72` - Movement animation | `cancelAnimationFrame` in cleanup | PARTIAL - If `targetX`/`targetY` change rapidly, multiple animation frames may queue before cleanup runs. However, the functional updater in `setPos` prevents state corruption. |

### 4.4 Threads (Rust)

| Location | Cleanup | Status |
|---|---|---|
| `lib.rs:294` - `std::thread::spawn` for watcher | No cleanup mechanism | LEAK - See CR-003 |

### 4.5 File Watchers (Rust)

| Location | Cleanup | Status |
|---|---|---|
| `lib.rs:301-314` - `RecommendedWatcher` | Dropped when thread exits (never) | LEAK - Watcher handle lives forever |

---

## 5. Error Handling Verification

### 5.1 Backend Error Handling

| Function | Error Source | Handling | Quality |
|---|---|---|---|
| `list_teams` | `read_dir` fails | `map_err` to String | Adequate |
| `list_teams` | Entry is not dir | `flatten()` + `unwrap_or(false)` | OK |
| `get_team_snapshot` | Config missing | Returns `Err` with path | Good |
| `get_team_snapshot` | Config parse fail | Returns `Err` with message | Good |
| `read_tasks` | Dir missing | Returns empty vec | OK |
| `read_tasks` | File read fail | Silently skipped | Needs logging (CR-009) |
| `read_tasks` | JSON parse fail | Silently skipped | Needs logging (CR-009) |
| `read_inbox` | File missing | Returns empty vec | OK |
| `read_inbox` | Parse fail | Falls through to NDJSON, then empty | OK but no logging |
| `watch_team` | Watcher creation fail | `eprintln!` + return | Adequate |
| `watch_team` | Watch path fail | Silently ignored (`let _ =`) | Needs logging |
| `watch_team` | `get_team_snapshot` fail inside loop | Silently ignored | Needs logging |
| `dirs_next` | HOME not set | Falls back to `/tmp` | Documented but risky (CR-008) |

### 5.2 Frontend Error Handling

| Location | Error Source | Handling | Quality |
|---|---|---|---|
| `useTeamData` | `invoke("list_teams")` | `console.error` | Adequate for dev |
| `useTeamData` | `invoke("get_team_snapshot")` | Sets `error` state | Good |
| `useTeamData` | `listen/invoke` for watcher | `console.error` | Adequate for dev |
| `Timeline.formatTimestamp` | Invalid date | `try/catch`, returns raw string | Good |
| Components | Unexpected data shape | No error boundaries | Needs improvement (CR-014) |

---

## 6. Improvement Suggestions

### 6.1 High Priority
1. **Fix CR-001**: Remove 100ms interval in OfficeView -- implement idle bounce via CSS animation or a per-agent `requestAnimationFrame`
2. **Fix CR-003**: Implement watcher lifecycle management with cancellation
3. **Fix CR-012**: Fix `in_progress` -> `inProgress` property mismatch in Dashboard taskStats
4. **Create App.tsx and main.tsx**: Required for the application to function
5. **Add Error Boundaries**: Prevent white-screen crashes

### 6.2 Medium Priority
6. **Extract shared utilities**: Move `getAgentColor` to `src/utils/agentUtils.ts`
7. **Fix CSP**: Enable proper content security policy
8. **Remove unused dependencies**: `tokio` and `glob` from Cargo.toml
9. **Fix InboxMessage type field**: Align TypeScript `msg_type` with actual JSON key `type`
10. **Disable polling in Tauri mode**: Only poll in browser/mock mode

### 6.3 Low Priority
11. **Improve accessibility**: Add ARIA attributes and keyboard navigation
12. **Add loading/error UI**: Consume loading and error states from useTeamData
13. **Use `&Path` instead of `&PathBuf`**: Rust API convention
14. **Add backend logging**: Replace silent error swallowing with `log` crate or `eprintln!`
15. **Document inbox message ordering**: Clarify chronological vs reverse-chronological

---

## 7. Positive Observations

1. **Clean type definitions**: Both Rust structs and TypeScript interfaces are well-structured with proper optional fields
2. **Consistent pixel-art theme**: Tailwind config, color palette, and component styling form a cohesive design system
3. **Smart data architecture**: Tauri backend reads from Claude's actual filesystem structure, enabling real monitoring
4. **Dual-mode support**: Browser mock mode enables frontend development without Tauri runtime
5. **Efficient file watching**: Using `notify` crate with debounce is the right approach
6. **Good component decomposition**: Each component has a clear single responsibility
7. **SVG pixel art**: Creative and performant approach to visual representation
8. **Proper React patterns**: `useMemo` for expensive computations, `useCallback` for stable references, `useRef` for intervals
