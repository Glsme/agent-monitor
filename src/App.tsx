import { useState, useEffect } from "react";
import { useTeamData } from "@/hooks/useTeamData";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { OfficeView } from "@/components/office/OfficeView";
import { ViewMode } from "@/types/agent";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);
  const { snapshot, teams, loading, error } = useTeamData(selectedTeam);

  // Auto-select first team, or switch if current team was deleted
  useEffect(() => {
    if (teams.length === 0) {
      setSelectedTeam(undefined);
    } else if (!selectedTeam || !teams.includes(selectedTeam)) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  if (loading && !snapshot) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-pixel-bg">
        <div className="text-center">
          <div className="text-2xl font-pixel text-pixel-accent animate-pulse-slow mb-4">
            LOADING
          </div>
          <div className="flex gap-1 justify-center">
            <span className="w-2 h-2 bg-pixel-accent rounded-sm animate-bounce-pixel" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-pixel-accent rounded-sm animate-bounce-pixel" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-pixel-accent rounded-sm animate-bounce-pixel" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-xs font-mono text-pixel-dim mt-4">Scanning agent teams...</p>
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-pixel-bg">
        <div className="text-center max-w-md px-4">
          <div className="text-lg font-pixel text-pixel-accent mb-3">ERROR</div>
          <p className="text-xs font-mono text-pixel-dim mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-mono bg-pixel-surface border border-pixel-panel text-pixel-text rounded hover:border-pixel-accent transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-pixel-bg overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-10 bg-pixel-surface border-b border-pixel-panel flex items-center justify-between px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <h1 className="text-[10px] font-pixel text-pixel-accent tracking-wider">
            AGENT MONITOR
          </h1>
          {snapshot && (
            <span className="text-[9px] font-mono text-pixel-dim">
              {snapshot.agents.length} agents
            </span>
          )}
        </div>

        {/* Center: View toggle */}
        <div className="flex items-center gap-1 bg-pixel-bg rounded p-0.5">
          <button
            onClick={() => setViewMode("dashboard")}
            className={`px-3 py-1 text-[9px] font-mono rounded transition-colors ${
              viewMode === "dashboard"
                ? "bg-pixel-panel text-pixel-bright"
                : "text-pixel-dim hover:text-pixel-text"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setViewMode("office")}
            className={`px-3 py-1 text-[9px] font-mono rounded transition-colors ${
              viewMode === "office"
                ? "bg-pixel-panel text-pixel-bright"
                : "text-pixel-dim hover:text-pixel-text"
            }`}
          >
            Office
          </button>
        </div>

        {/* Right: Team selector */}
        <div className="flex items-center gap-2">
          {teams.length > 1 && (
            <select
              value={selectedTeam || ""}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-pixel-bg border border-pixel-panel text-pixel-text text-[10px] font-mono rounded px-2 py-1 outline-none focus:border-pixel-accent"
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          )}
          {error && (
            <span className="text-[9px] font-mono text-pixel-accent" title={error}>
              !
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {snapshot ? (
          viewMode === "dashboard" ? (
            <Dashboard snapshot={snapshot} />
          ) : (
            <OfficeView snapshot={snapshot} />
          )
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-mono text-pixel-dim">No team data available</p>
          </div>
        )}
      </main>
    </div>
  );
}
