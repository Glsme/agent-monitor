import { useState, useCallback, useRef, useEffect } from "react";
import { TeamSnapshot } from "@/types/agent";
import { TerminalEntry, TerminalEntryType, BroadcastResponse } from "@/types/terminal";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalOutput } from "./TerminalOutput";
import { TerminalInput } from "./TerminalInput";

interface TerminalPanelProps {
  snapshot: TeamSnapshot | null;
  isOpen: boolean;
  onToggle: () => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7;
const DEFAULT_HEIGHT = 280;

let lineIdCounter = 0;
function nextLineId(): string {
  return `line-${++lineIdCounter}`;
}

function createLine(type: TerminalEntryType, content: string): TerminalEntry {
  return {
    id: nextLineId(),
    type,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function TerminalPanel({ snapshot, isOpen, onToggle }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalEntry[]>([]);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; height: number }>({ y: 0, height: DEFAULT_HEIGHT });

  const teamName = snapshot?.team_name || "no-team";
  const agentNames = snapshot?.agents.map((a) => a.name) || [];

  // Keyboard shortcut: Ctrl+` to toggle terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        onToggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);

  // Drag-to-resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, height: panelHeight };
  }, [panelHeight]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartRef.current.y - e.clientY;
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
      const newHeight = Math.min(maxH, Math.max(MIN_HEIGHT, dragStartRef.current.height + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Clear terminal
  const handleClear = useCallback(() => {
    setLines([]);
  }, []);

  // Command processing
  const handleCommand = useCallback(
    (command: string) => {
      // Save to history
      setCommandHistory((prev) => [command, ...prev.slice(0, 99)]);

      // Echo the input
      setLines((prev) => [...prev, createLine("input", command)]);

      const parts = command.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case "/help": {
          const helpTarget = parts[1]?.toLowerCase();

          if (helpTarget) {
            // Detailed help for specific command
            const cmdHelp: Record<string, string[]> = {
              msg: [
                "Usage: /msg <agent-name> <message>",
                "",
                "Send a message to a specific agent.",
                "",
                "Example: /msg developer Please start the API integration",
                "",
                "The agent name must match an agent in the current team.",
              ],
              broadcast: [
                "Usage: /broadcast <message>",
                "",
                "Send a message to all agents in the team.",
                "",
                "Example: /broadcast Code review meeting in 10 minutes",
              ],
              status: [
                "Usage: /status [agent-name]",
                "",
                "Show team status summary, or detailed status for a specific agent.",
                "",
                "Examples:",
                "  /status              Show team overview",
                "  /status developer    Show developer's details",
              ],
              tasks: [
                "Usage: /tasks [--filter <status>] [--agent <name>]",
                "",
                "List tasks. Optionally filter by status or agent.",
                "",
                "Examples:",
                "  /tasks                          Show all tasks",
                "  /tasks --filter in_progress     Show active tasks",
                "  /tasks --agent developer        Show developer's tasks",
              ],
              inbox: [
                "Usage: /inbox <agent-name>",
                "",
                "Show recent messages for a specific agent.",
                "",
                "Example: /inbox team-lead",
              ],
              agents: [
                "Usage: /agents",
                "",
                "List all agents in the team with their status and type.",
              ],
              clear: [
                "Usage: /clear",
                "",
                "Clear all terminal output.",
              ],
              history: [
                "Usage: /history",
                "",
                "Show recent command history.",
              ],
            };

            const help = cmdHelp[helpTarget];
            if (help) {
              setLines((prev) => [...prev, ...help.map((l) => createLine("system", l))]);
            } else {
              setLines((prev) => [...prev, createLine("error", `No help available for "${helpTarget}". Type /help for command list.`)]);
            }
            break;
          }

          const helpLines = [
            "Agent Monitor Terminal - Available Commands",
            "",
            "Messages:",
            "  /msg <agent> <message>     Send message to agent",
            "  /broadcast <message>       Send message to all agents",
            "",
            "Status:",
            "  /status [agent]            Show team or agent status",
            "  /tasks [options]           List tasks",
            "  /inbox <agent>             Show agent inbox",
            "  /agents                    List team agents",
            "",
            "Utility:",
            "  /help [command]            Show help",
            "  /clear                     Clear terminal",
            "  /history                   Show command history",
            "",
            "Shortcuts: Tab (autocomplete), Up/Down (history), Ctrl+` (toggle)",
            "Type /help <command> for detailed usage.",
          ];
          setLines((prev) => [
            ...prev,
            ...helpLines.map((l) => createLine("system", l)),
          ]);
          break;
        }

        case "/status": {
          if (!snapshot) {
            setLines((prev) => [...prev, createLine("error", "No team data available")]);
            break;
          }

          const targetAgent = parts[1];

          // Per-agent status
          if (targetAgent) {
            const agent = snapshot.agents.find((a) => a.name === targetAgent);
            if (!agent) {
              setLines((prev) => [
                ...prev,
                createLine("error", `Agent "${targetAgent}" not found. Available: ${agentNames.join(", ")}`),
              ]);
              break;
            }

            const agentStatusLines = [
              `Agent: ${agent.name}`,
              `Status: ${agent.status}`,
              agent.agent_type ? `Type: ${agent.agent_type}` : null,
              agent.current_task
                ? `Current Task: #${agent.current_task.id} ${agent.current_task.subject}`
                : "Current Task: none",
              `Tasks: ${agent.task_count.pending} pending / ${agent.task_count.in_progress} in_progress / ${agent.task_count.completed} completed`,
              `Recent Messages: ${agent.recent_messages.length}`,
            ].filter((l): l is string => l !== null);

            setLines((prev) => [
              ...prev,
              ...agentStatusLines.map((l) => createLine("success", l)),
            ]);
            break;
          }

          // Team status
          const working = snapshot.agents.filter((a) => a.status === "working").length;
          const idle = snapshot.agents.filter((a) => a.status === "idle").length;
          const blocked = snapshot.agents.filter((a) => a.status === "blocked").length;
          const offline = snapshot.agents.filter((a) => a.status === "offline").length;
          const tasksDone = snapshot.all_tasks.filter((t) => t.status === "completed").length;
          const totalTasks = snapshot.all_tasks.length;

          const statusLines = [
            `Team: ${snapshot.team_name} (${snapshot.agents.length} agents)`,
            snapshot.description ? `  ${snapshot.description}` : null,
            "",
            ...snapshot.agents.map((a) => {
              const task = a.current_task
                ? `  ${a.current_task.activeForm || a.current_task.subject}`
                : "";
              const blockedInfo = a.status === "blocked" && a.current_task?.blockedBy?.length
                ? ` (blocked by #${a.current_task.blockedBy.join(", #")})`
                : "";
              return `  ${a.name.padEnd(16)} [${a.status}]${task}${blockedInfo}`;
            }),
            "",
            `Tasks: ${tasksDone}/${totalTasks} completed`,
          ].filter((l): l is string => l !== null);

          setLines((prev) => [
            ...prev,
            ...statusLines.map((l) => createLine("success", l)),
          ]);
          break;
        }

        case "/agents": {
          if (!snapshot) {
            setLines((prev) => [...prev, createLine("error", "No team data available")]);
            break;
          }

          const agentLines = snapshot.agents.map((a) => {
            const typeStr = (a.agent_type || "").padEnd(20);
            return `  ${a.name.padEnd(16)} ${typeStr} [${a.status}]`;
          });

          setLines((prev) => [
            ...prev,
            createLine("system", `Team: ${snapshot.team_name}`),
            ...agentLines.map((l) => createLine("output", l)),
          ]);
          break;
        }

        case "/tasks": {
          if (!snapshot) {
            setLines((prev) => [...prev, createLine("error", "No team data available")]);
            break;
          }

          // Parse flags
          const flags: Record<string, string> = {};
          for (let i = 1; i < parts.length; i++) {
            if (parts[i].startsWith("--") && parts[i + 1]) {
              flags[parts[i].slice(2)] = parts[i + 1];
              i++;
            }
          }

          let tasks = snapshot.all_tasks;

          if (flags.filter) {
            tasks = tasks.filter((t) => t.status === flags.filter);
          }
          if (flags.agent) {
            tasks = tasks.filter((t) => t.owner === flags.agent);
          }

          const statusSymbol: Record<string, string> = {
            pending: "[ ]",
            in_progress: "[~]",
            completed: "[x]",
          };

          const taskLines = tasks.map((t) => {
            const sym = statusSymbol[t.status] || "[ ]";
            const owner = t.owner ? ` @${t.owner}` : " (unassigned)";
            const blockedStr = t.blockedBy?.length ? ` (blocked by #${t.blockedBy.join(", #")})` : "";
            return `  ${sym} #${t.id.padEnd(4)} ${t.subject}${owner}${blockedStr}`;
          });

          setLines((prev) => [
            ...prev,
            createLine("system", `Tasks (${snapshot.team_name})`),
            ...taskLines.map((l) => createLine("output", l)),
            createLine("output", ""),
            createLine("output", `Total: ${tasks.length} shown / ${snapshot.all_tasks.length} total`),
          ]);
          break;
        }

        case "/inbox": {
          if (!snapshot) {
            setLines((prev) => [...prev, createLine("error", "No team data available")]);
            break;
          }

          const targetAgent = parts[1];
          if (!targetAgent) {
            setLines((prev) => [...prev, createLine("error", "Usage: /inbox <agent-name>")]);
            break;
          }

          const agent = snapshot.agents.find((a) => a.name === targetAgent);
          if (!agent) {
            setLines((prev) => [
              ...prev,
              createLine("error", `Agent "${targetAgent}" not found. Available: ${agentNames.join(", ")}`),
            ]);
            break;
          }

          if (agent.recent_messages.length === 0) {
            setLines((prev) => [
              ...prev,
              createLine("system", `Inbox: ${targetAgent}`),
              createLine("output", "  No recent messages"),
            ]);
            break;
          }

          const msgLines = agent.recent_messages.map((m) => {
            const time = m.timestamp
              ? new Date(m.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
              : "??:??";
            const from = m.from || "unknown";
            const text = m.summary || m.content?.slice(0, 80) || "";
            return `  [${time}] ${from}: ${text}`;
          });

          setLines((prev) => [
            ...prev,
            createLine("system", `Inbox: ${targetAgent} (${agent.recent_messages.length} messages)`),
            ...msgLines.map((l) => createLine("output", l)),
          ]);
          break;
        }

        case "/msg": {
          const targetAgent = parts[1];
          const message = parts.slice(2).join(" ");

          if (!targetAgent || !message) {
            setLines((prev) => [
              ...prev,
              createLine("error", "Usage: /msg <agent-name> <message>"),
            ]);
            break;
          }

          if (!agentNames.includes(targetAgent)) {
            setLines((prev) => [
              ...prev,
              createLine("error", `Agent "${targetAgent}" not found. Available: ${agentNames.join(", ")}`),
            ]);
            break;
          }

          // Try Tauri backend, fall back to mock
          (async () => {
            try {
              if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("send_message_to_agent", {
                  teamName,
                  agentName: targetAgent,
                  message,
                });
                setLines((prev) => [
                  ...prev,
                  createLine("success", `Message sent to @${targetAgent}: "${message}"`),
                ]);
              } else {
                setLines((prev) => [
                  ...prev,
                  createLine("success", `Message to @${targetAgent}: "${message}"`),
                  createLine("system", "[dev mode] Message delivery simulated"),
                ]);
              }
            } catch (err) {
              setLines((prev) => [
                ...prev,
                createLine("error", `Failed to send message: ${String(err)}`),
              ]);
            }
          })();
          break;
        }

        case "/broadcast": {
          const message = parts.slice(1).join(" ");

          if (!message) {
            setLines((prev) => [
              ...prev,
              createLine("error", "Usage: /broadcast <message>"),
            ]);
            break;
          }

          if (!snapshot || agentNames.length === 0) {
            setLines((prev) => [...prev, createLine("error", "No agents available to broadcast to")]);
            break;
          }

          (async () => {
            try {
              if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
                const { invoke } = await import("@tauri-apps/api/core");
                const result = await invoke<BroadcastResponse>("broadcast_message", {
                  teamName,
                  message,
                });
                setLines((prev) => [
                  ...prev,
                  createLine("success", `Broadcast sent to ${result.succeeded.length}/${result.total} agents`),
                  ...(result.failed.length > 0
                    ? [createLine("error", `Failed: ${result.failed.map(([n]) => n).join(", ")}`)]
                    : []),
                ]);
              } else {
                setLines((prev) => [
                  ...prev,
                  createLine("success", `Broadcast to ${agentNames.length} agents: "${message}"`),
                  createLine("system", "[dev mode] Broadcast delivery simulated"),
                ]);
              }
            } catch (err) {
              setLines((prev) => [
                ...prev,
                createLine("error", `Failed to broadcast: ${String(err)}`),
              ]);
            }
          })();
          break;
        }

        case "/assign": {
          const targetAgent = parts[1];
          const taskDesc = parts.slice(2).join(" ");

          if (!targetAgent || !taskDesc) {
            setLines((prev) => [
              ...prev,
              createLine("error", "Usage: /assign <agent-name> <task description>"),
            ]);
            break;
          }

          if (!agentNames.includes(targetAgent)) {
            setLines((prev) => [
              ...prev,
              createLine("error", `Agent "${targetAgent}" not found. Available: ${agentNames.join(", ")}`),
            ]);
            break;
          }

          setLines((prev) => [
            ...prev,
            createLine("success", `Task assigned to @${targetAgent}: "${taskDesc}"`),
            createLine("system", "[Phase 2] Task assignment requires backend integration"),
          ]);
          break;
        }

        case "/history": {
          if (commandHistory.length === 0) {
            setLines((prev) => [...prev, createLine("system", "No command history")]);
            break;
          }

          const historyLines = commandHistory.slice(0, 20).map((cmd, i) =>
            `  ${String(i + 1).padStart(3)}  ${cmd}`
          );

          setLines((prev) => [
            ...prev,
            createLine("system", `Command History (recent ${Math.min(commandHistory.length, 20)}):`),
            ...historyLines.map((l) => createLine("output", l)),
          ]);
          break;
        }

        case "/clear": {
          handleClear();
          break;
        }

        default: {
          if (cmd.startsWith("/")) {
            setLines((prev) => [
              ...prev,
              createLine("error", `Unknown command: ${cmd}. Type /help for available commands.`),
            ]);
          } else {
            setLines((prev) => [
              ...prev,
              createLine("error", "Commands must start with /. Type /help for available commands."),
            ]);
          }
        }
      }
    },
    [snapshot, agentNames, teamName, commandHistory, handleClear]
  );

  // If closed, only show the header bar
  if (!isOpen) {
    return (
      <div
        className="flex-shrink-0 border-t border-pixel-panel"
        style={{
          boxShadow: "0 -1px 4px rgba(0,0,0,0.3)",
        }}
      >
        <TerminalHeader
          teamName={teamName}
          isOpen={false}
          onToggle={onToggle}
          onClear={handleClear}
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="flex-shrink-0 flex flex-col border-t border-pixel-panel bg-pixel-bg"
      style={{
        height: panelHeight,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Drag handle */}
      <div
        className={`h-1 cursor-row-resize flex-shrink-0 group ${
          isDragging ? "bg-pixel-accent" : "bg-pixel-panel hover:bg-pixel-accent/50"
        } transition-colors`}
        onMouseDown={handleDragStart}
      >
        {/* Visual grip dots */}
        <div className="flex justify-center items-center h-full gap-1">
          <span className="w-1 h-1 rounded-full bg-pixel-dim/40 group-hover:bg-pixel-dim/80" />
          <span className="w-1 h-1 rounded-full bg-pixel-dim/40 group-hover:bg-pixel-dim/80" />
          <span className="w-1 h-1 rounded-full bg-pixel-dim/40 group-hover:bg-pixel-dim/80" />
        </div>
      </div>

      {/* Header */}
      <TerminalHeader
        teamName={teamName}
        isOpen={true}
        onToggle={onToggle}
        onClear={handleClear}
      />

      {/* Output area */}
      <TerminalOutput lines={lines} />

      {/* Input area */}
      <TerminalInput
        onSubmit={handleCommand}
        agentNames={agentNames}
      />
    </div>
  );
}
