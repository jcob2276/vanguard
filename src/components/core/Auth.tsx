import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Fingerprint, Lock } from 'lucide-react';
import { SYSTEM_VERSION, NEURAL_LINK_VERSION, STORAGE_KEYS } from '../../lib/constants';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync theme with document class on mount
  useEffect(() => {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        setMessage('Link do resetu hasła wysłany na e-mail.');
        return;
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Konto utworzone. Sprawdź e-mail jeśli wymagana jest weryfikacja.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: unknown) {
      const msg = error instanceof Error ? (error as Error).message : String(error);
      setError(msg === 'Invalid login credentials' ? 'Błędne poświadczenia dostępu.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden transition-colors duration-[var(--motion-slow)]">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-background/50"></div>
      <div className="absolute top-[var(--legacy-arbitrary-023)] right-[var(--legacy-arbitrary-024)] w-[var(--legacy-w-089)] h-[var(--legacy-h-034)] bg-primary/5 rounded-full blur-[var(--blur-ambient)]"></div>
      <div className="absolute bottom-[var(--legacy-arbitrary-025)] left-[var(--legacy-arbitrary-026)] w-[var(--legacy-w-089)] h-[var(--legacy-h-034)] bg-primary/3 rounded-full blur-[var(--blur-ambient)] opacity-[var(--opacity-20)]"></div>

      <div className="w-full max-w-md relative z-[var(--z-raised)] animate-in fade-in zoom-in-95 duration-[var(--motion-ambient)]">
        <div className="bg-surface/55 border border-border-custom backdrop-blur-[var(--blur-2xl)] rounded-[var(--radius-xl)] p-10 shadow-lg">

          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-primary/10 rounded-[var(--radius-xl)] flex items-center justify-center mb-6 border border-primary/20 relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-[var(--radius-xl)] blur-[var(--blur-xl)] opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] transition-opacity duration-[var(--motion-ambient)]"></div>
              <Fingerprint className="text-primary relative z-[var(--z-raised)] animate-pulse" size={40} />
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight text-text-primary uppercase italic">
              Vanguard OS <span className="text-primary not-italic text-sm align-top ml-1">v{SYSTEM_VERSION}</span>
            </h1>
            <p className="text-text-muted text-xs font-black uppercase tracking-[var(--legacy-arbitrary-027)] mt-2">Identity Verification Required</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {message && (
              <div className="bg-success/10 border border-success/20 text-success p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-text-muted uppercase tracking-widest ml-4">Access ID</label>
              <div className="relative">
                <ControlInput
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-2xl py-4 px-6 text-sm text-text-primary focus:border-primary/50 focus:bg-surface-solid focus:shadow-focus transition-all outline-none placeholder:text-text-muted/40 font-bold"
                  placeholder="name@vanguard.sys"
                />
              </div>
            </div>

            {mode !== 'reset' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-text-muted uppercase tracking-widest ml-4">Secure Key</label>
              <div className="relative">
                <ControlInput
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-2xl py-4 px-6 text-sm text-text-primary focus:border-primary/50 focus:bg-surface-solid focus:shadow-focus transition-all outline-none placeholder:text-text-muted/40 font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>
            )}

            <Pressable
              type="submit"
              loading={loading}
              icon={!loading ? <Lock size={16} /> : undefined}
              className="w-full py-5 font-black text-xs uppercase tracking-[var(--legacy-arbitrary-002)] mt-4"
            >
              {mode === 'reset' ? 'Wyślij link resetu' : mode === 'signup' ? 'Utwórz konto' : 'Inicjuj Sesję'}
            </Pressable>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-bold text-text-muted">
            {mode !== 'signin' && (
              <Pressable type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="hover:text-primary cursor-pointer">Logowanie</Pressable>
            )}
            {mode !== 'signup' && (
              <Pressable type="button" onClick={() => { setMode('signup'); setError(null); setMessage(null); }} className="hover:text-primary cursor-pointer">Rejestracja</Pressable>
            )}
            {mode !== 'reset' && (
              <Pressable type="button" onClick={() => { setMode('reset'); setError(null); setMessage(null); }} className="hover:text-primary cursor-pointer">Reset hasła</Pressable>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-border-custom text-center">
            <div className="flex items-center justify-center gap-2 text-text-muted">
              <Shield size={12} />
              <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)]">Encrypted Connection Active</p>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-2xs font-black text-text-muted/50 uppercase tracking-[var(--legacy-arbitrary-028)]">
          Authorized Personnel Only • Neural Link {NEURAL_LINK_VERSION}
        </p>
      </div>
    </div>
  );
}
