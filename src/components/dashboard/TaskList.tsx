import { TaskData, STATUS_COLORS } from "@/types/agent";

interface TaskListProps {
  tasks: TaskData[];
}

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  in_progress: "◎",
  completed: "●",
};

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-pixel-dim text-xs font-mono py-4">
        No tasks
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tasks.map((task) => {
        const statusColor =
          task.status === "completed"
            ? STATUS_COLORS.working
            : task.status === "in_progress"
            ? "#ffd93d"
            : "#8892b0";

        return (
          <div
            key={task.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-pixel-surface/50 transition-colors"
          >
            <span className="text-xs" style={{ color: statusColor }}>
              {STATUS_ICON[task.status] || "○"}
            </span>
            <span className="text-[10px] font-mono text-pixel-dim w-5">
              #{task.id}
            </span>
            <span
              className={`flex-1 text-[11px] font-mono truncate ${
                task.status === "completed"
                  ? "text-pixel-dim line-through"
                  : "text-pixel-text"
              }`}
            >
              {task.subject}
            </span>
            {task.owner && (
              <span className="text-[9px] font-mono text-pixel-blue">
                @{task.owner}
              </span>
            )}
            {task.blockedBy && task.blockedBy.length > 0 && (
              <span className="text-[9px] font-mono text-pixel-accent">
                blocked
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
