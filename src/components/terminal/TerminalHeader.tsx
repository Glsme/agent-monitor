interface TerminalHeaderProps {
  teamName: string;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export function TerminalHeader({ teamName, isOpen, onToggle, onClear }: TerminalHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 bg-pixel-surface border-b border-pixel-panel select-none"
      style={{
        boxShadow: "inset 0 -1px 0 #0f3460",
      }}
    >
      {/* Left: Terminal label + team context */}
      <div className="flex items-center gap-2">
        {/* Terminal icon (pixel art) */}
        <svg width="14" height="14" viewBox="0 0 16 16" className="flex-shrink-0" style={{ imageRendering: "pixelated" }}>
          <rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="#e94560" strokeWidth="1.5" />
          <polyline points="4,6 7,8.5 4,11" fill="none" stroke="#00d98b" strokeWidth="1.5" strokeLinecap="square" />
          <line x1="9" y1="11" x2="12" y2="11" stroke="#8892b0" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
        <span className="text-[9px] font-pixel text-pixel-accent tracking-wider">
          TERMINAL
        </span>
        <span className="text-[9px] font-mono text-pixel-dim">
          [{teamName}]
        </span>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1">
        {isOpen && (
          <button
            onClick={onClear}
            className="px-2 py-0.5 text-[9px] font-mono text-pixel-dim hover:text-pixel-text transition-colors rounded hover:bg-pixel-panel/50"
            title="Clear output"
          >
            clear
          </button>
        )}
        <button
          onClick={onToggle}
          className="px-1.5 py-0.5 text-pixel-dim hover:text-pixel-bright transition-colors rounded hover:bg-pixel-panel/50"
          title={isOpen ? "Minimize terminal" : "Expand terminal"}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
            {isOpen ? (
              /* Chevron down (minimize) */
              <polyline points="4,6 8,10 12,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            ) : (
              /* Chevron up (expand) */
              <polyline points="4,10 8,6 12,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
