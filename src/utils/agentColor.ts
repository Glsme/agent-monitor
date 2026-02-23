import { AGENT_COLORS } from "@/types/agent";

export function getAgentColor(name: string, agentType?: string): string {
  const key = (agentType || name).toLowerCase();
  for (const [k, v] of Object.entries(AGENT_COLORS)) {
    if (key.includes(k)) return v;
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = Object.values(AGENT_COLORS);
  return colors[Math.abs(hash) % colors.length];
}
