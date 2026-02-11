import { TimelineEvent, STATUS_COLORS } from "@/types/agent";

interface TimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  task_started: { icon: "▶", color: STATUS_COLORS.working },
  task_completed: { icon: "✓", color: "#00d98b" },
  message_sent: { icon: "◆", color: "#4fc3f7" },
  status_change: { icon: "●", color: "#ffd93d" },
};

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return ts;
  }
}

export function Timeline({ events, maxItems = 50 }: TimelineProps) {
  const visibleEvents = events.slice(0, maxItems);

  if (visibleEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-pixel-dim text-xs font-mono">
        No events yet...
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {visibleEvents.map((event, i) => {
        const config = EVENT_ICONS[event.event_type] || EVENT_ICONS.status_change;
        return (
          <div
            key={`${event.timestamp}-${i}`}
            className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-pixel-surface/50 transition-colors group"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center pt-0.5">
              <span className="text-xs" style={{ color: config.color }}>
                {config.icon}
              </span>
              {i < visibleEvents.length - 1 && (
                <div className="w-px h-full min-h-[12px] bg-pixel-surface mt-0.5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono font-semibold text-pixel-blue">
                  {event.agent}
                </span>
                <span className="text-[9px] font-mono text-pixel-dim">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className="text-[11px] font-mono text-pixel-text truncate group-hover:whitespace-normal">
                {event.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
