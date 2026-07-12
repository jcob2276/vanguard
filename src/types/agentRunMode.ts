export type AgentRunMode = 'auto' | 'confirm' | 'readOnly';

const KEY = 'vanguard_agent_run_mode';

export function getAgentRunMode(): AgentRunMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || v === 'confirm' || v === 'readOnly') return v;
  } catch (err) {
    console.debug('[agentRunMode] failed to read agent run mode', err);
  }
  return 'auto';
}
