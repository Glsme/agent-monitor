import { useEffect, useState, useRef } from "react";
import { AgentState, AGENT_COLORS, STATUS_COLORS } from "@/types/agent";

interface PixelAgentProps {
  agent: AgentState;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  onClick?: () => void;
  selected?: boolean;
}

function getAgentColor(name: string, agentType?: string): string {
  const key = agentType?.toLowerCase() || name.toLowerCase();
  for (const [k, v] of Object.entries(AGENT_COLORS)) {
    if (key.includes(k)) return v;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = Object.values(AGENT_COLORS);
  return colors[Math.abs(hash) % colors.length];
}

export function PixelAgent({ agent, x, y, targetX, targetY, onClick, selected }: PixelAgentProps) {
  const [pos, setPos] = useState({ x, y });
  const [frame, setFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const animRef = useRef<number>();

  const color = getAgentColor(agent.name, agent.agent_type);
  const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.offline;

  // Smooth movement animation
  useEffect(() => {
    const speed = 1.5;
    let stopped = false;

    const animate = () => {
      if (stopped) return;

      setPos((prev) => {
        const ddx = targetX - prev.x;
        const ddy = targetY - prev.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);

        if (d < 1) {
          setIsMoving(false);
          return { x: targetX, y: targetY };
        }

        setIsMoving(true);

        if (d < speed) {
          return { x: targetX, y: targetY };
        }

        return {
          x: prev.x + (ddx / d) * speed,
          y: prev.y + (ddy / d) * speed,
        };
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      stopped = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetX, targetY]);

  // Walking animation frames
  useEffect(() => {
    if (!isMoving) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 200);
    return () => clearInterval(interval);
  }, [isMoving]);

  // Idle bounce for working agents
  const idleBounce = agent.status === "working" && !isMoving;

  // Speech bubble for active task
  const showBubble = agent.current_task && !isMoving;

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={onClick}
      className="cursor-pointer"
      style={{ filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined }}
    >
      {/* Shadow */}
      <ellipse cx="0" cy="22" rx="8" ry="3" fill="rgba(0,0,0,0.3)" />

      {/* Body group with animation */}
      <g>
        {idleBounce && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0;0,-1.5;0,0;0,1.5;0,0"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
        {/* Walking leg animation */}
        {isMoving ? (
          <>
            <rect x="-3" y="14" width="3" height="6" fill={color} opacity="0.9"
              transform={`rotate(${frame % 2 === 0 ? 15 : -15}, -1.5, 14)`} />
            <rect x="0" y="14" width="3" height="6" fill={color} opacity="0.9"
              transform={`rotate(${frame % 2 === 0 ? -15 : 15}, 1.5, 14)`} />
          </>
        ) : (
          <>
            <rect x="-3" y="14" width="3" height="5" fill={color} opacity="0.9" />
            <rect x="0" y="14" width="3" height="5" fill={color} opacity="0.9" />
          </>
        )}

        {/* Body */}
        <rect x="-5" y="4" width="10" height="10" rx="1" fill={color} />

        {/* Head */}
        <rect x="-6" y="-6" width="12" height="10" rx="1" fill={color} />

        {/* Eyes */}
        <rect x="-4" y="-3" width="2" height="2" fill="#1a1a2e" />
        <rect x="2" y="-3" width="2" height="2" fill="#1a1a2e" />

        {/* Eye blink */}
        {frame === 3 && (
          <>
            <rect x="-4" y="-2" width="2" height="1" fill={color} />
            <rect x="2" y="-2" width="2" height="1" fill={color} />
          </>
        )}

        {/* Arms */}
        <rect x="-8" y="5" width="3" height="7" rx="1" fill={color} opacity="0.85"
          transform={isMoving ? `rotate(${frame % 2 === 0 ? -20 : 20}, -6.5, 5)` : ""} />
        <rect x="5" y="5" width="3" height="7" rx="1" fill={color} opacity="0.85"
          transform={isMoving ? `rotate(${frame % 2 === 0 ? 20 : -20}, 6.5, 5)` : ""} />

        {/* Status indicator glow */}
        <circle cx="7" cy="-5" r="2.5" fill={statusColor} opacity="0.9">
          {agent.status === "working" && (
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
          )}
        </circle>
      </g>

      {/* Name tag */}
      <g transform="translate(0, 26)">
        <rect
          x={-(agent.name.length * 1.7 + 3)}
          y="-1"
          width={agent.name.length * 3.4 + 6}
          height="7"
          rx="1.5"
          fill="rgba(0,0,0,0.75)"
        />
        <text
          textAnchor="middle"
          y="4.5"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "4px", fill: "#e6f1ff", letterSpacing: "0.3px" }}
        >
          {agent.name}
        </text>
      </g>

      {/* Speech bubble for active task */}
      {showBubble && (
        <g transform="translate(12, -20)">
          <rect x="0" y="-12" width="70" height="16" rx="3" fill="rgba(0,0,0,0.8)" stroke={statusColor} strokeWidth="0.5" />
          {/* Arrow */}
          <polygon points="-2,-2 4,-6 4,2" fill="rgba(0,0,0,0.8)" />
          <text
            x="4"
            y="-1"
            className="text-[6px] font-mono"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "6px", fill: statusColor }}
          >
            {(agent.current_task?.activeForm || agent.current_task?.subject || "").slice(0, 16)}
            {(agent.current_task?.activeForm || agent.current_task?.subject || "").length > 16 ? "..." : ""}
          </text>
        </g>
      )}

      {/* Selection ring */}
      {selected && (
        <rect
          x="-10"
          y="-10"
          width="20"
          height="35"
          rx="3"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.7"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
}
