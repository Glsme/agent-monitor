interface ProgressBarProps {
  pending: number;
  inProgress: number;
  completed: number;
}

export function ProgressBar({ pending, inProgress, completed }: ProgressBarProps) {
  const total = pending + inProgress + completed;
  if (total === 0) return null;

  const pctCompleted = (completed / total) * 100;
  const pctInProgress = (inProgress / total) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-[9px] font-mono text-pixel-dim mb-1">
        <span>{completed}/{total} done</span>
        <span>{Math.round(pctCompleted)}%</span>
      </div>
      <div className="w-full h-1.5 bg-pixel-bg rounded-full overflow-hidden flex">
        <div
          className="h-full bg-pixel-green transition-all duration-500"
          style={{ width: `${pctCompleted}%` }}
        />
        <div
          className="h-full bg-pixel-yellow transition-all duration-500"
          style={{ width: `${pctInProgress}%` }}
        />
      </div>
    </div>
  );
}
