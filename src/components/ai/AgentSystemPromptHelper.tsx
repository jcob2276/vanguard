import { useState, useEffect } from 'react';
import { Save, RotateCcw, Info } from 'lucide-react';

const STORAGE_KEY = 'vanguard_oracle_user_conf';
const PLACEHOLDER = `# Twoje instrukcje dla Oracle
# Każda linia zaczyna się od '-' lub '#' (komentarz)
# Przykłady:
# - Preferuję odpowiedzi po angielsku
# - Zawsze dodawaj emoji do wiadomości o treningu
# - Nie pytaj o moją dietę — mam to pod kontrolą`;

export function AgentSystemPromptHelper() {
  const [conf, setConf] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try { setConf(localStorage.getItem(STORAGE_KEY) ?? ''); } catch {}
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, conf);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const handleReset = () => {
    setConf('');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setDirty(false);
  };

  return (
    <div className="rounded-[20px] border p-4 space-y-3"
      style={{ background: 'white', borderColor: 'rgba(153,161,175,0.14)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Oracle — instrukcje użytkownika</span>
        <div className="group relative ml-auto">
          <Info size={13} style={{ color: 'var(--color-text-tertiary)' }} />
          <div className="absolute right-0 top-5 w-56 rounded-xl p-2.5 text-[10px] leading-relaxed hidden group-hover:block z-10"
            style={{ background: 'var(--surface-solid)', border: '1px solid rgba(153,161,175,0.2)', color: 'var(--text-secondary)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
            Te instrukcje są dołączane do każdego zapytania do Oracle. Używaj do stałych preferencji i zakazów.
          </div>
        </div>
      </div>

      <textarea
        value={conf}
        onChange={e => { setConf(e.target.value); setDirty(true); }}
        placeholder={PLACEHOLDER}
        rows={6}
        className="w-full rounded-xl px-3 py-2.5 text-[12px] font-mono leading-relaxed resize-none outline-none transition-all"
        style={{
          background: 'rgba(153,161,175,0.04)',
          border: `1px solid ${dirty ? 'rgba(91,108,255,0.3)' : 'rgba(153,161,175,0.14)'}`,
          color: 'var(--text-primary)',
        }}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition-all active:scale-95"
          style={{ background: 'rgba(244,63,94,0.06)', color: '#F43F5E' }}
        >
          <RotateCcw size={11} />
          Wyczyść
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty && !saved}
          className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all active:scale-95"
          style={{
            background: saved ? 'rgba(16,185,129,0.1)' : 'rgba(91,108,255,0.1)',
            color: saved ? '#10B981' : '#5B6CFF',
            opacity: !dirty && !saved ? 0.4 : 1,
          }}
        >
          <Save size={11} />
          {saved ? 'Zapisano!' : 'Zapisz'}
        </button>
      </div>
    </div>
  );
}

/** Read user conf to inject into Oracle system prompt (call in gatherUserContext or OracleCard) */
export function getOracleUserConf(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return '';
    return raw.trim();
  } catch {
    return '';
  }
}
