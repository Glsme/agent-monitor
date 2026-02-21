export interface TeamMember {
  name: string;
  agentId: string;
  agentType?: string;
}

export interface TaskData {
  id: string;
  subject: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
  activeForm?: string;
  blockedBy?: string[];
  blocks?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InboxMessage {
  from?: string;
  to?: string;
  content?: string;
  type?: string;
  timestamp?: string;
  summary?: string;
}

export interface TaskCount {
  pending: number;
  in_progress: number;
  completed: number;
}

export interface AgentState {
  name: string;
  agent_id: string;
  agent_type?: string;
  status: "idle" | "working" | "blocked" | "offline";
  current_task?: TaskData;
  recent_messages: InboxMessage[];
  task_count: TaskCount;
}

export interface TimelineEvent {
  timestamp: string;
  agent: string;
  event_type: "task_started" | "task_completed" | "message_sent" | "status_change";
  description: string;
}

export interface TeamSnapshot {
  team_name: string;
  description?: string;
  agents: AgentState[];
  all_tasks: TaskData[];
  timeline: TimelineEvent[];
}

export type ViewMode = "dashboard" | "office";

export type StatusFilter = "all" | "idle" | "working" | "blocked" | "offline";

// Pixel art agent visual config
export interface AgentVisual {
  color: string;
  icon: string;
  roomIndex: number;
}

export const AGENT_COLORS: Record<string, string> = {
  planner: "#ffd93d",
  researcher: "#4fc3f7",
  developer: "#00d98b",
  "ui-designer": "#b388ff",
  "ux-designer": "#ff80ab",
  tester: "#ffab40",
  reviewer: "#e94560",
  default: "#8892b0",
};

export const STATUS_COLORS: Record<string, string> = {
  idle: "#8892b0",
  working: "#00d98b",
  blocked: "#e94560",
  offline: "#4a4a5e",
};

export const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  working: "Working",
  blocked: "Blocked",
  offline: "Offline",
};

// Curated 12-color palette for custom agent colors (4x3 grid)
// - Excludes STATUS_COLORS (#8892b0, #00d98b, #e94560, #4a4a5e) to avoid status confusion
// - Excludes eye color (#1a1a2e) and dark background-similar colors
// - Some overlap with AGENT_COLORS defaults is intentional (allows role-swapping)
export const CUSTOM_COLOR_PALETTE: string[] = [
  "#ffd93d", // yellow (default: planner)
  "#4fc3f7", // sky blue (default: researcher)
  "#b388ff", // purple (default: ui-designer)
  "#ff80ab", // pink (default: ux-designer)
  "#ffab40", // orange (default: tester)
  "#80deea", // cyan
  "#c6ff00", // lime
  "#f48fb1", // rose
  "#69f0ae", // mint
  "#ffa726", // amber
  "#ce93d8", // lavender
  "#aed581", // light green
];
