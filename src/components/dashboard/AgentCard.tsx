import { AgentState, AGENT_COLORS, STATUS_COLORS } from "@/types/agent";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProgressBar } from "@/components/common/ProgressBar";

interface AgentCardProps {
  agent: AgentState;
  onClick?: () => void;
  selected?: boolean;
  customColor?: string;
}

function getAgentColor(name: string, agentType?: string): string {
  const key = agentType?.toLowerCase() || name.toLowerCase();
  for (const [k, v] of Object.entries(AGENT_COLORS)) {
    if (key.includes(k)) return v;
  }
  // Generate a stable color from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = Object.values(AGENT_COLORS);
  return colors[Math.abs(hash) % colors.length];
}

function AgentAvatar({ name, agentType, status, customColor }: { name: string; agentType?: string; status: string; customColor?: string }) {
  const color = customColor || getAgentColor(name, agentType);
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline;

  // Pixel art avatar as inline SVG
  return (
    <div className="relative">
      <svg width="40" height="40" viewBox="0 0 16 16" className="image-rendering-pixelated">
        {/* Body */}
        <rect x="5" y="2" width="6" height="4" fill={color} />
        <rect x="4" y="6" width="8" height="5" fill={color} />
        <rect x="6" y="11" width="4" height="3" fill={color} />
        {/* Eyes */}
        <rect x="6" y="3" width="1" height="1" fill="#1a1a2e" />
        <rect x="9" y="3" width="1" height="1" fill="#1a1a2e" />
        {/* Mouth */}
        <rect x="7" y="5" width="2" height="1" fill="#1a1a2e" opacity="0.5" />
        {/* Arms */}
        <rect x="3" y="7" width="1" height="3" fill={color} opacity="0.8" />
        <rect x="12" y="7" width="1" height="3" fill={color} opacity="0.8" />
      </svg>
      {/* Status indicator */}
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-pixel-surface ${status === "working" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: statusColor }}
      />
    </div>
  );
}

export function AgentCard({ agent, onClick, selected, customColor }: AgentCardProps) {
  const { name, agent_type, status, current_task, task_count, recent_messages } = agent;
  const borderColor = selected ? STATUS_COLORS[status] || "#8892b0" : "transparent";
  const avatarColor = customColor || getAgentColor(name, agent_type);

  return (
    <div
      onClick={onClick}
      className={`
        relative p-3 rounded-lg cursor-pointer transition-all duration-200
        bg-pixel-surface hover:bg-pixel-panel
        border-2 border-opacity-60
        ${selected ? "ring-1 ring-opacity-40" : ""}
      `}
      style={{
        borderColor,
        boxShadow: selected ? `0 0 12px ${borderColor}30` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          name={name}
          agentType={agent_type}
          status={status}
          customColor={avatarColor}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-mono font-semibold text-pixel-bright truncate">
              {name}
            </h3>
            <StatusBadge status={status} size="sm" />
          </div>

          {agent_type && (
            <p className="text-[10px] font-mono text-pixel-dim truncate mb-1.5">
              {agent_type}
            </p>
          )}

          {current_task && (
            <div className="mb-2 p-1.5 rounded bg-pixel-bg/50">
              <p className="text-[10px] font-mono text-pixel-yellow truncate">
                {current_task.activeForm || current_task.subject}
              </p>
            </div>
          )}

          {!current_task && status === "idle" && (
            <div className="mb-2 p-1.5 rounded bg-pixel-bg/30">
              <p className="text-[10px] font-mono text-pixel-dim italic">
                Waiting for tasks...
              </p>
            </div>
          )}

          <ProgressBar
            pending={task_count.pending}
            inProgress={task_count.in_progress}
            completed={task_count.completed}
          />

          {recent_messages.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-[9px] text-pixel-blue">
                {recent_messages.length} msg{recent_messages.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
