import { useState, useMemo } from "react";
import { TeamSnapshot, StatusFilter as StatusFilterType, AgentState } from "@/types/agent";
import { AgentCard } from "./AgentCard";
import { StatusFilter } from "./StatusFilter";
import { Timeline } from "./Timeline";
import { TaskList } from "./TaskList";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useAgentCustomColors } from "@/hooks/useAgentCustomColors";

interface DashboardProps {
  snapshot: TeamSnapshot;
}

export function Dashboard({ snapshot }: DashboardProps) {
  const [filter, setFilter] = useState<StatusFilterType>("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { getCustomColor } = useAgentCustomColors(snapshot.team_name);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of snapshot.agents) {
      counts[agent.status] = (counts[agent.status] || 0) + 1;
    }
    return counts;
  }, [snapshot.agents]);

  const filteredAgents = useMemo(() => {
    if (filter === "all") return snapshot.agents;
    return snapshot.agents.filter((a) => a.status === filter);
  }, [snapshot.agents, filter]);

  const taskStats = useMemo(() => {
    const tasks = snapshot.all_tasks;
    return {
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    };
  }, [snapshot.all_tasks]);

  const selectedAgentData = useMemo<AgentState | undefined>(() => {
    if (!selectedAgent) return undefined;
    return snapshot.agents.find((a) => a.name === selectedAgent);
  }, [snapshot.agents, selectedAgent]);

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      {/* Header stats */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-pixel text-pixel-bright tracking-wider">
            {snapshot.team_name}
          </h2>
          {snapshot.description && (
            <p className="text-[10px] font-mono text-pixel-dim mt-0.5">
              {snapshot.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-lg font-mono font-bold text-pixel-bright">
              {snapshot.agents.length}
            </span>
            <span className="text-[10px] font-mono text-pixel-dim ml-1">agents</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-mono font-bold text-pixel-green">
              {taskStats.completed}
            </span>
            <span className="text-[10px] font-mono text-pixel-dim ml-1">
              /{snapshot.all_tasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      {/* Global progress */}
      <div className="flex-shrink-0">
        <ProgressBar pending={taskStats.pending} inProgress={taskStats.in_progress} completed={taskStats.completed} />
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0">
        <StatusFilter current={filter} onChange={setFilter} counts={statusCounts} />
      </div>

      {/* Main content: agents + sidebar */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Agent grid */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                customColor={getCustomColor(agent.name)}
                selected={selectedAgent === agent.name}
                onClick={() =>
                  setSelectedAgent(
                    selectedAgent === agent.name ? null : agent.name
                  )
                }
              />
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="flex items-center justify-center h-32 text-pixel-dim text-xs font-mono">
              No agents match filter
            </div>
          )}
        </div>

        {/* Right sidebar: details / timeline */}
        <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col gap-2 min-h-0">
          {/* Agent detail or task list */}
          <div className="bg-pixel-surface rounded-lg p-3 flex-shrink-0 max-h-[40%] overflow-y-auto">
            <h3 className="text-[10px] font-pixel text-pixel-dim mb-2 uppercase tracking-widest">
              {selectedAgentData ? `${selectedAgentData.name} Tasks` : "All Tasks"}
            </h3>
            <TaskList
              tasks={
                selectedAgentData
                  ? snapshot.all_tasks.filter(
                      (t) => t.owner === selectedAgentData.name
                    )
                  : snapshot.all_tasks
              }
            />
          </div>

          {/* Timeline */}
          <div className="bg-pixel-surface rounded-lg p-3 flex-1 overflow-y-auto min-h-0">
            <h3 className="text-[10px] font-pixel text-pixel-dim mb-2 uppercase tracking-widest">
              Timeline
            </h3>
            <Timeline
              events={
                selectedAgent
                  ? snapshot.timeline.filter((e) => e.agent === selectedAgent)
                  : snapshot.timeline
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
