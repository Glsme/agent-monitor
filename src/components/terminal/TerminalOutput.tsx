import { useEffect, useRef } from "react";
import { TerminalEntry, TerminalEntryType } from "@/types/terminal";

interface TerminalOutputProps {
  lines: TerminalEntry[];
}

const LINE_COLORS: Record<TerminalEntryType, string> = {
  input: "#ccd6f6",
  output: "#8892b0",
  error: "#e94560",
  system: "#4fc3f7",
  success: "#00d98b",
};

const LINE_PREFIX: Record<TerminalEntryType, string> = {
  input: "> ",
  output: "  ",
  error: "! ",
  system: "* ",
  success: "  ",
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function TerminalOutput({ lines }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  // Track if user has scrolled up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isAutoScrollRef.current = atBottom;
  };

  // Auto-scroll to bottom when new lines appear
  useEffect(() => {
    if (isAutoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 scrollbar-thin"
      >
        <div className="text-pixel-dim text-[11px] font-mono space-y-1">
          <p style={{ color: "#4fc3f7" }}>* Welcome to Agent Monitor Terminal</p>
          <p style={{ color: "#8892b0" }}>  Type /help for available commands</p>
          <p style={{ color: "#8892b0" }}>  Type /status to view team status</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 scrollbar-thin"
    >
      <div className="space-y-0.5">
        {lines.map((line) => {
          const color = LINE_COLORS[line.type];
          const prefix = LINE_PREFIX[line.type];
          const time = formatTime(line.timestamp);

          return (
            <div
              key={line.id}
              className="flex items-start gap-2 group font-mono text-[11px] leading-relaxed"
            >
              {/* Timestamp (visible on hover) */}
              <span className="text-[9px] text-pixel-dim opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 w-14 text-right pt-0.5 select-none">
                {time}
              </span>

              {/* Line content */}
              <span style={{ color }} className="whitespace-pre-wrap break-all">
                <span className="select-none opacity-60">{prefix}</span>
                {line.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
