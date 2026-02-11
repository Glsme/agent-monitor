import { useState, useEffect, useCallback, useRef } from "react";
import { TeamSnapshot } from "@/types/agent";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () => typeof window.__TAURI_INTERNALS__ !== "undefined";

// Mock data for browser development
function createMockSnapshot(): TeamSnapshot {
  const now = new Date().toISOString();
  return {
    team_name: "demo-team",
    description: "Claude Code Agent Team Demo",
    agents: [
      {
        name: "team-lead",
        agent_id: "lead-001",
        agent_type: "general-purpose",
        status: "working",
        current_task: {
          id: "1",
          subject: "Coordinate team implementation",
          status: "in_progress",
          owner: "team-lead",
          activeForm: "Coordinating team",
          updatedAt: now,
        },
        recent_messages: [
          { from: "developer", content: "Backend API is ready", timestamp: now, summary: "API ready" },
        ],
        task_count: { pending: 1, in_progress: 1, completed: 2 },
      },
      {
        name: "developer",
        agent_id: "dev-002",
        agent_type: "ios-swift-developer",
        status: "working",
        current_task: {
          id: "3",
          subject: "Implement core data models",
          status: "in_progress",
          owner: "developer",
          activeForm: "Implementing models",
          updatedAt: now,
        },
        recent_messages: [],
        task_count: { pending: 0, in_progress: 1, completed: 3 },
      },
      {
        name: "researcher",
        agent_id: "res-003",
        agent_type: "Explore",
        status: "idle",
        recent_messages: [
          { from: "team-lead", content: "Please investigate caching strategies", timestamp: now, summary: "Research caching" },
        ],
        task_count: { pending: 2, in_progress: 0, completed: 1 },
      },
      {
        name: "tester",
        agent_id: "test-004",
        agent_type: "mobile-testing",
        status: "blocked",
        current_task: {
          id: "5",
          subject: "Write integration tests",
          status: "in_progress",
          owner: "tester",
          activeForm: "Writing tests",
          blockedBy: ["3"],
          updatedAt: now,
        },
        recent_messages: [],
        task_count: { pending: 1, in_progress: 1, completed: 0 },
      },
      {
        name: "reviewer",
        agent_id: "rev-005",
        agent_type: "code-reviewer",
        status: "idle",
        recent_messages: [],
        task_count: { pending: 0, in_progress: 0, completed: 4 },
      },
    ],
    all_tasks: [
      { id: "1", subject: "Coordinate team implementation", status: "in_progress", owner: "team-lead", activeForm: "Coordinating", updatedAt: now },
      { id: "2", subject: "Set up project structure", status: "completed", owner: "developer", updatedAt: now },
      { id: "3", subject: "Implement core data models", status: "in_progress", owner: "developer", activeForm: "Implementing models", updatedAt: now },
      { id: "4", subject: "Research caching strategies", status: "pending", owner: "researcher", updatedAt: now },
      { id: "5", subject: "Write integration tests", status: "in_progress", owner: "tester", blockedBy: ["3"], activeForm: "Writing tests", updatedAt: now },
      { id: "6", subject: "Review API endpoints", status: "completed", owner: "reviewer", updatedAt: now },
      { id: "7", subject: "Design system setup", status: "completed", owner: "team-lead", updatedAt: now },
      { id: "8", subject: "Performance optimization", status: "pending", updatedAt: now },
    ],
    timeline: [
      { timestamp: now, agent: "developer", event_type: "task_started", description: "[in_progress] Implement core data models" },
      { timestamp: new Date(Date.now() - 60000).toISOString(), agent: "team-lead", event_type: "message_sent", description: "Assigned research task to researcher" },
      { timestamp: new Date(Date.now() - 120000).toISOString(), agent: "developer", event_type: "task_completed", description: "[completed] Set up project structure" },
      { timestamp: new Date(Date.now() - 180000).toISOString(), agent: "reviewer", event_type: "task_completed", description: "[completed] Review API endpoints" },
      { timestamp: new Date(Date.now() - 240000).toISOString(), agent: "tester", event_type: "status_change", description: "[blocked] Waiting on data models" },
      { timestamp: new Date(Date.now() - 300000).toISOString(), agent: "team-lead", event_type: "task_completed", description: "[completed] Design system setup" },
    ],
  };
}

export function useTeamData(teamName?: string) {
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadTeams = useCallback(async () => {
    if (!isTauri()) {
      setTeams(["demo-team"]);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<string[]>("list_teams");
      setTeams(result);
    } catch (e) {
      console.error("Failed to list teams:", e);
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (!teamName) return;

    if (!isTauri()) {
      setSnapshot(createMockSnapshot());
      setLoading(false);
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<TeamSnapshot>("get_team_snapshot", { teamName });
      setSnapshot(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [teamName]);

  // Listen for real-time updates from Tauri watcher
  useEffect(() => {
    if (!isTauri() || !teamName) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const { invoke } = await import("@tauri-apps/api/core");

        unlisten = await listen<TeamSnapshot>("team-update", (event) => {
          setSnapshot(event.payload);
        });

        await invoke("watch_team", { teamName });
      } catch (e) {
        console.error("Failed to set up watcher:", e);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [teamName]);

  // Poll teams + snapshot every 3s
  useEffect(() => {
    loadTeams();
    loadSnapshot();
    intervalRef.current = setInterval(() => {
      loadTeams();
      loadSnapshot();
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadTeams, loadSnapshot]);

  return { snapshot, teams, loading, error, refresh: loadSnapshot };
}
