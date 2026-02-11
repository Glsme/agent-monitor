import { ViewMode } from "@/types/agent";

interface ViewToggleProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex rounded border border-pixel-panel/50 overflow-hidden"
      style={{
        boxShadow: "inset -1px -1px 0 #0f3460, inset 1px 1px 0 #233a5e",
      }}
    >
      <button
        onClick={() => onChange("dashboard")}
        className={`px-2.5 py-1.5 transition-colors duration-150 ${
          current === "dashboard"
            ? "bg-pixel-panel text-pixel-bright"
            : "bg-pixel-surface text-pixel-dim hover:text-pixel-text"
        }`}
        title="Dashboard View"
      >
        {/* Grid icon (4 squares) */}
        <svg width="14" height="14" viewBox="0 0 16 16" className="image-rendering-pixelated">
          <rect x="1" y="1" width="6" height="6" fill="currentColor" />
          <rect x="9" y="1" width="6" height="6" fill="currentColor" />
          <rect x="1" y="9" width="6" height="6" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => onChange("office")}
        className={`px-2.5 py-1.5 transition-colors duration-150 ${
          current === "office"
            ? "bg-pixel-panel text-pixel-bright"
            : "bg-pixel-surface text-pixel-dim hover:text-pixel-text"
        }`}
        title="Office View"
      >
        {/* Building icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" className="image-rendering-pixelated">
          <rect x="3" y="2" width="10" height="13" fill="currentColor" />
          <rect x="5" y="4" width="2" height="2" fill="#1a1a2e" />
          <rect x="9" y="4" width="2" height="2" fill="#1a1a2e" />
          <rect x="5" y="8" width="2" height="2" fill="#1a1a2e" />
          <rect x="9" y="8" width="2" height="2" fill="#1a1a2e" />
          <rect x="6" y="12" width="4" height="3" fill="#1a1a2e" />
        </svg>
      </button>
    </div>
  );
}
