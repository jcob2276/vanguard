export type AgentRunMode = 'auto' | 'confirm' | 'readOnly';

const KEY = 'vanguard_agent_run_mode';

export function getAgentRunMode(): AgentRunMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || v === 'confirm' || v === 'readOnly') return v;
  } catch {}
  return 'auto';
}

export function setAgentRunMode(mode: AgentRunMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
