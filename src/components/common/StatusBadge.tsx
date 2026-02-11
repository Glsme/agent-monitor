import { STATUS_COLORS, STATUS_LABELS } from "@/types/agent";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const label = STATUS_LABELS[status] || status;
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${dotSize} rounded-full ${status === "working" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
      />
      <span className={`${textSize} font-mono uppercase tracking-wider`} style={{ color }}>
        {label}
      </span>
    </span>
  );
}
