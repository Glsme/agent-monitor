interface RoomProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: "workspace" | "meeting" | "lounge" | "server";
  isActive?: boolean;
}

const ROOM_COLORS = {
  workspace: { fill: "#16213e", stroke: "#0f3460", floor: "#1a1a2e" },
  meeting: { fill: "#1a2340", stroke: "#0f3460", floor: "#1e1e38" },
  lounge: { fill: "#1e2235", stroke: "#0f3460", floor: "#22223a" },
  server: { fill: "#141a30", stroke: "#0f3460", floor: "#181828" },
};

export function OfficeRoom({ x, y, width, height, label, type, isActive }: RoomProps) {
  const colors = ROOM_COLORS[type];

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Floor */}
      <rect
        width={width}
        height={height}
        fill={colors.floor}
        rx="2"
      />

      {/* Floor pattern (pixel tiles) */}
      {Array.from({ length: Math.floor(width / 16) }).map((_, i) =>
        Array.from({ length: Math.floor(height / 16) }).map((_, j) => (
          <rect
            key={`${i}-${j}`}
            x={i * 16 + 1}
            y={j * 16 + 1}
            width="14"
            height="14"
            fill={colors.fill}
            opacity={(i + j) % 2 === 0 ? 0.3 : 0.15}
            rx="1"
          />
        ))
      )}

      {/* Walls */}
      <rect
        width={width}
        height={height}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="2"
        rx="2"
      />

      {/* Active room glow */}
      {isActive && (
        <rect
          width={width}
          height={height}
          fill="none"
          stroke="#00d98b"
          strokeWidth="1"
          rx="2"
          opacity="0.3"
        >
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Room label */}
      <text
        x={width / 2}
        y="14"
        textAnchor="middle"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "6px",
          fill: "#8892b0",
          opacity: 0.6,
        }}
      >
        {label}
      </text>

      {/* Furniture based on room type */}
      {type === "workspace" && <WorkspaceFurniture width={width} height={height} />}
      {type === "meeting" && <MeetingFurniture width={width} height={height} />}
      {type === "lounge" && <LoungeFurniture width={width} height={height} />}
      {type === "server" && <ServerFurniture width={width} height={height} />}
    </g>
  );
}

function WorkspaceFurniture({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.5">
      {/* Desks */}
      <rect x={width * 0.15} y={height * 0.35} width="20" height="12" fill="#2a2a4a" rx="1" />
      <rect x={width * 0.55} y={height * 0.35} width="20" height="12" fill="#2a2a4a" rx="1" />
      <rect x={width * 0.15} y={height * 0.65} width="20" height="12" fill="#2a2a4a" rx="1" />
      <rect x={width * 0.55} y={height * 0.65} width="20" height="12" fill="#2a2a4a" rx="1" />
      {/* Monitor screens */}
      <rect x={width * 0.18} y={height * 0.32} width="6" height="4" fill="#4fc3f7" opacity="0.4" rx="0.5" />
      <rect x={width * 0.58} y={height * 0.32} width="6" height="4" fill="#00d98b" opacity="0.4" rx="0.5" />
      <rect x={width * 0.18} y={height * 0.62} width="6" height="4" fill="#ffd93d" opacity="0.4" rx="0.5" />
      <rect x={width * 0.58} y={height * 0.62} width="6" height="4" fill="#b388ff" opacity="0.4" rx="0.5" />
    </g>
  );
}

function MeetingFurniture({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.5">
      {/* Table */}
      <rect x={width * 0.3} y={height * 0.35} width={width * 0.4} height={height * 0.3} fill="#2a2a4a" rx="3" />
      {/* Whiteboard */}
      <rect x={width * 0.35} y={height * 0.22} width={width * 0.3} height="3" fill="#4a4a6a" />
    </g>
  );
}

function LoungeFurniture({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.5">
      {/* Couch */}
      <rect x={width * 0.15} y={height * 0.5} width="25" height="10" fill="#3a2a4a" rx="2" />
      {/* Plant */}
      <circle cx={width * 0.75} cy={height * 0.4} r="5" fill="#2a6a3a" />
      <rect x={width * 0.75 - 1} y={height * 0.45} width="2" height="8" fill="#4a3a2a" />
      {/* Coffee table */}
      <rect x={width * 0.4} y={height * 0.55} width="14" height="8" fill="#3a3a5a" rx="1" />
    </g>
  );
}

function ServerFurniture({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.5">
      {/* Server racks */}
      {[0.2, 0.4, 0.6].map((xPct) => (
        <g key={xPct}>
          <rect x={width * xPct} y={height * 0.3} width="10" height="20" fill="#2a2a4a" rx="1" />
          {/* Blinking lights */}
          {[0, 4, 8, 12].map((dy) => (
            <rect key={dy} x={width * xPct + 2} y={height * 0.32 + dy} width="2" height="1.5" fill="#00d98b" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur={`${1 + xPct}s`} repeatCount="indefinite" />
            </rect>
          ))}
        </g>
      ))}
    </g>
  );
}
