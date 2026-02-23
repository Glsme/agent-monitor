import { AgentState } from "@/types/agent";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { StatusBadge } from "@/components/common/StatusBadge";

interface SelectedAgentPanelProps {
  agent: AgentState;
  displayColor: string;
  hasCustomColor: boolean;
  showColorPicker: boolean;
  onToggleColorPicker: () => void;
  onCloseColorPicker: () => void;
  onApplyColor: (color: string) => void;
  onResetColor: () => void;
}

export function SelectedAgentPanel({
  agent,
  displayColor,
  hasCustomColor,
  showColorPicker,
  onToggleColorPicker,
  onCloseColorPicker,
  onApplyColor,
  onResetColor,
}: SelectedAgentPanelProps) {
  return (
    <div className="flex-shrink-0 bg-pixel-surface border-t border-pixel-panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-1">
            <button
              onClick={onToggleColorPicker}
              className="flex items-center gap-1 cursor-pointer"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{
                  backgroundColor: displayColor,
                  boxShadow: hasCustomColor ? `0 0 3px ${displayColor}` : "none",
                }}
              />
              <span className="text-[9px] text-pixel-dim hover:text-pixel-bright">/</span>
            </button>
            {showColorPicker && (
              <ColorPickerPopover
                currentColor={displayColor}
                hasCustomColor={hasCustomColor}
                onApply={onApplyColor}
                onReset={onResetColor}
                onClose={onCloseColorPicker}
              />
            )}
          </div>
          <span className="text-sm font-mono font-semibold text-pixel-bright">
            {agent.name}
          </span>
          <StatusBadge status={agent.status} />
          {agent.agent_type && (
            <span className="text-[10px] font-mono text-pixel-dim">
              ({agent.agent_type})
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="text-pixel-green">{agent.task_count.completed} done</span>
          <span className="text-pixel-yellow">{agent.task_count.in_progress} active</span>
          <span className="text-pixel-dim">{agent.task_count.pending} pending</span>
        </div>
      </div>

      {agent.current_task && (
        <div className="mt-2 p-2 rounded bg-pixel-bg/50">
          <p className="text-[11px] font-mono text-pixel-yellow">
            {agent.current_task.activeForm || agent.current_task.subject}
          </p>
        </div>
      )}

      {agent.recent_messages.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[9px] font-mono text-pixel-blue">
            Latest: {agent.recent_messages[0]?.summary || agent.recent_messages[0]?.content?.slice(0, 60)}
          </p>
        </div>
      )}
    </div>
  );
}
