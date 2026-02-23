import { useState, useCallback } from "react";

const STORAGE_KEY = "agent-monitor-custom-colors";
const STORAGE_VERSION = 1;

interface StoredColors {
  version: number;
  colors: Record<string, string>; // key: "teamName::agentName", value: hex color
}

function buildKey(teamName: string, agentName: string): string {
  return `${teamName}::${agentName}`;
}

function loadColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: StoredColors = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed.colors;
  } catch {
    return {};
  }
}

function saveColors(colors: Record<string, string>): void {
  try {
    const data: StoredColors = { version: STORAGE_VERSION, colors };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function useAgentCustomColors(teamName: string) {
  const [colors, setColors] = useState<Record<string, string>>(loadColors);

  const getCustomColor = useCallback(
    (agentName: string): string | undefined => {
      return colors[buildKey(teamName, agentName)];
    },
    [colors, teamName]
  );

  const setCustomColor = useCallback(
    (agentName: string, color: string) => {
      setColors((prev) => {
        const next = { ...prev, [buildKey(teamName, agentName)]: color };
        saveColors(next);
        return next;
      });
    },
    [teamName]
  );

  const resetCustomColor = useCallback(
    (agentName: string) => {
      setColors((prev) => {
        const next = { ...prev };
        delete next[buildKey(teamName, agentName)];
        saveColors(next);
        return next;
      });
    },
    [teamName]
  );

  return { getCustomColor, setCustomColor, resetCustomColor };
}
