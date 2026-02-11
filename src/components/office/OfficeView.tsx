import { useState, useMemo } from "react";
import { TeamSnapshot, AgentState, STATUS_COLORS } from "@/types/agent";
import { PixelAgent } from "./PixelAgent";
import { OfficeRoom } from "./OfficeRoom";
import { StatusBadge } from "@/components/common/StatusBadge";

interface OfficeViewProps {
  snapshot: TeamSnapshot;
}

interface RoomConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: "workspace" | "meeting" | "lounge" | "server";
}

// Office layout rooms
const ROOMS: RoomConfig[] = [
  { x: 20, y: 20, width: 200, height: 150, label: "WORKSPACE A", type: "workspace" },
  { x: 230, y: 20, width: 200, height: 150, label: "WORKSPACE B", type: "workspace" },
  { x: 440, y: 20, width: 150, height: 150, label: "SERVER ROOM", type: "server" },
  { x: 20, y: 180, width: 170, height: 120, label: "MEETING ROOM", type: "meeting" },
  { x: 200, y: 180, width: 160, height: 120, label: "LOUNGE", type: "lounge" },
  { x: 370, y: 180, width: 220, height: 120, label: "WORKSPACE C", type: "workspace" },
];

function getAgentRoom(agent: AgentState): number {
  switch (agent.status) {
    case "working":
      // Distribute workers across workspace rooms
      return [0, 1, 5][Math.abs(hashString(agent.name)) % 3];
    case "blocked":
      return 3; // Meeting room (discussing blockers)
    case "idle":
      return 4; // Lounge
    case "offline":
      return 2; // Server room
    default:
      return 0;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function getPositionInRoom(room: RoomConfig, index: number, total: number): { x: number; y: number } {
  const padding = 30;
  const availW = room.width - padding * 2;
  const availH = room.height - padding * 2;

  if (total <= 1) {
    return {
      x: room.x + room.width / 2,
      y: room.y + room.height / 2 + 5,
    };
  }

  const cols = Math.min(total, 3);
  const row = Math.floor(index / cols);
  const col = index % cols;
  const colSpacing = availW / (cols + 1);
  const rows = Math.ceil(total / cols);
  const rowSpacing = availH / (rows + 1);

  return {
    x: room.x + padding + colSpacing * (col + 1),
    y: room.y + padding + rowSpacing * (row + 1) + 5,
  };
}

export function OfficeView({ snapshot }: OfficeViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Compute agent positions
  const agentPositions = useMemo(() => {
    const roomAgents: Record<number, AgentState[]> = {};

    for (const agent of snapshot.agents) {
      const roomIdx = getAgentRoom(agent);
      if (!roomAgents[roomIdx]) roomAgents[roomIdx] = [];
      roomAgents[roomIdx].push(agent);
    }

    const positions: Record<string, { x: number; y: number; room: number }> = {};

    for (const [roomIdxStr, agents] of Object.entries(roomAgents)) {
      const roomIdx = Number(roomIdxStr);
      const room = ROOMS[roomIdx];
      if (!room) continue;

      agents.forEach((agent, i) => {
        const pos = getPositionInRoom(room, i, agents.length);
        positions[agent.name] = { ...pos, room: roomIdx };
      });
    }

    return positions;
  }, [snapshot.agents]);

  // Active rooms (rooms with working agents)
  const activeRooms = useMemo(() => {
    const active = new Set<number>();
    for (const pos of Object.values(agentPositions)) {
      const agent = snapshot.agents.find(a => a.name === Object.keys(agentPositions).find(k => agentPositions[k] === pos));
      if (agent?.status === "working") active.add(pos.room);
    }
    return active;
  }, [agentPositions, snapshot.agents]);

  const selectedAgentData = useMemo(() => {
    if (!selectedAgent) return undefined;
    return snapshot.agents.find((a) => a.name === selectedAgent);
  }, [snapshot.agents, selectedAgent]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Office canvas */}
      <div className="flex-1 relative overflow-hidden bg-pixel-bg">
        <svg
          viewBox="0 0 610 320"
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="none" stroke="#ffffff" strokeWidth="0.3" opacity="0.03" />
            </pattern>
          </defs>
          <rect width="610" height="320" fill="url(#grid)" />

          {/* Rooms */}
          {ROOMS.map((room, i) => (
            <OfficeRoom
              key={i}
              {...room}
              isActive={activeRooms.has(i)}
            />
          ))}

          {/* Hallway paths (connecting corridors) */}
          <line x1="120" y1="170" x2="120" y2="180" stroke="#2a2a4a" strokeWidth="8" opacity="0.3" />
          <line x1="330" y1="170" x2="330" y2="180" stroke="#2a2a4a" strokeWidth="8" opacity="0.3" />
          <line x1="480" y1="170" x2="480" y2="180" stroke="#2a2a4a" strokeWidth="8" opacity="0.3" />
          <line x1="220" y1="95" x2="230" y2="95" stroke="#2a2a4a" strokeWidth="8" opacity="0.3" />
          <line x1="430" y1="95" x2="440" y2="95" stroke="#2a2a4a" strokeWidth="8" opacity="0.3" />

          {/* Agents */}
          {snapshot.agents.map((agent) => {
            const pos = agentPositions[agent.name];
            if (!pos) return null;

            return (
              <PixelAgent
                key={agent.name}
                agent={agent}
                x={pos.x}
                y={pos.y}
                targetX={pos.x}
                targetY={pos.y}
                selected={selectedAgent === agent.name}
                onClick={() =>
                  setSelectedAgent(selectedAgent === agent.name ? null : agent.name)
                }
              />
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-3 bg-black/50 rounded-lg px-3 py-2 backdrop-blur-sm">
          {(["working", "idle", "blocked", "offline"] as const).map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="text-[9px] font-mono text-pixel-dim capitalize">{status}</span>
            </div>
          ))}
        </div>

        {/* Room legend */}
        <div className="absolute top-3 right-3 bg-black/50 rounded-lg px-3 py-2 backdrop-blur-sm">
          <span className="text-[8px] font-pixel text-pixel-dim tracking-wider">
            {snapshot.team_name.toUpperCase()} OFFICE
          </span>
        </div>
      </div>

      {/* Bottom info panel */}
      {selectedAgentData && (
        <div className="flex-shrink-0 bg-pixel-surface border-t border-pixel-panel p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-semibold text-pixel-bright">
                {selectedAgentData.name}
              </span>
              <StatusBadge status={selectedAgentData.status} />
              {selectedAgentData.agent_type && (
                <span className="text-[10px] font-mono text-pixel-dim">
                  ({selectedAgentData.agent_type})
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="text-pixel-green">
                {selectedAgentData.task_count.completed} done
              </span>
              <span className="text-pixel-yellow">
                {selectedAgentData.task_count.in_progress} active
              </span>
              <span className="text-pixel-dim">
                {selectedAgentData.task_count.pending} pending
              </span>
            </div>
          </div>
          {selectedAgentData.current_task && (
            <div className="mt-2 p-2 rounded bg-pixel-bg/50">
              <p className="text-[11px] font-mono text-pixel-yellow">
                {selectedAgentData.current_task.activeForm || selectedAgentData.current_task.subject}
              </p>
            </div>
          )}
          {selectedAgentData.recent_messages.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[9px] font-mono text-pixel-blue">
                Latest: {selectedAgentData.recent_messages[0]?.summary || selectedAgentData.recent_messages[0]?.content?.slice(0, 60)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
