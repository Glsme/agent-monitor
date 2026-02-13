// Terminal output entry types
export type TerminalEntryType = "input" | "output" | "error" | "success" | "system";

export interface TerminalEntry {
  id: string;
  type: TerminalEntryType;
  content: string;
  timestamp: string;
}

// Parsed command structure
export interface ParsedCommand {
  command: string;
  args: string[];
  flags: Record<string, string>;
  raw: string;
}

// Command execution result
export interface CommandResult {
  success: boolean;
  entries: TerminalEntry[];
}

// Tauri invoke: send message request
export interface SendMessageRequest {
  teamName: string;
  agentName: string;
  message: string;
  messageType?: string;
}

// Tauri invoke: send message response
export interface SendMessageResponse {
  success: boolean;
  error?: string;
  timestamp: string;
}

// Tauri invoke: broadcast response
export interface BroadcastResponse {
  total: number;
  succeeded: string[];
  failed: [string, string][];
  timestamp: string;
}

// Terminal panel state
export interface TerminalState {
  isOpen: boolean;
  panelHeight: number;
  entries: TerminalEntry[];
  commandHistory: string[];
  historyIndex: number;
}
