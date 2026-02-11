import { StatusFilter as StatusFilterType, STATUS_COLORS, STATUS_LABELS } from "@/types/agent";

interface StatusFilterProps {
  current: StatusFilterType;
  onChange: (filter: StatusFilterType) => void;
  counts: Record<string, number>;
}

const FILTERS: StatusFilterType[] = ["all", "working", "idle", "blocked", "offline"];

export function StatusFilter({ current, onChange, counts }: StatusFilterProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {FILTERS.map((filter) => {
        const isActive = current === filter;
        const color = filter === "all" ? "#ccd6f6" : STATUS_COLORS[filter];
        const count = filter === "all"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : counts[filter] || 0;

        return (
          <button
            key={filter}
            onClick={() => onChange(filter)}
            className={`
              px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wide
              transition-all duration-150 border
              ${isActive
                ? "border-opacity-60 bg-opacity-20"
                : "border-transparent bg-pixel-surface hover:bg-pixel-panel"
              }
            `}
            style={{
              color: isActive ? color : "#8892b0",
              borderColor: isActive ? color : "transparent",
              backgroundColor: isActive ? `${color}15` : undefined,
            }}
          >
            {STATUS_LABELS[filter] || "All"} ({count})
          </button>
        );
      })}
    </div>
  );
}
