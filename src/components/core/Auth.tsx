import { useEffect, useState } from 'react';
import { Fingerprint, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { STORAGE_KEYS } from '../../lib/constants';
import { ControlInput, Pressable } from '../ui/ControlPrimitives';

type AuthMode = 'signin' | 'signup' | 'reset';

const COPY: Record<AuthMode, { title: string; subtitle: string; submit: string }> = {
  signin: { title: 'Witaj ponownie', subtitle: 'Zaloguj się do swojego Vanguard.', submit: 'Zaloguj się' },
  signup: { title: 'Utwórz konto', subtitle: 'Jedno prywatne miejsce dla Twojego systemu.', submit: 'Utwórz konto' },
  reset: { title: 'Odzyskaj dostęp', subtitle: 'Wyślemy bezpieczny link na Twój adres e-mail.', submit: 'Wyślij link' },
};

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetError) throw resetError;
        setMessage('Link do odzyskania dostępu został wysłany.');
      } else if (mode === 'signup') {
        const { error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) throw signupError;
        setMessage('Konto utworzone. Sprawdź pocztę, jeśli wymagana jest weryfikacja.');
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({ email, password });
        if (signinError) throw signinError;
      }
    } catch (caught: unknown) {
      const value = caught instanceof Error ? caught.message : String(caught);
      setError(value === 'Invalid login credentials' ? 'Nieprawidłowy e-mail lub hasło.' : value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-10 text-text-primary">
      <section className="relative w-full max-w-sm">
        <div className="rounded-[var(--radius-xl)] border border-border-custom bg-surface p-7 shadow-xl sm:p-8">
          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Fingerprint size={25} strokeWidth={1.8} />
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight">{COPY[mode].title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{COPY[mode].subtitle}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {message ? <p role="status" className="rounded-xl bg-success/10 px-3 py-2.5 text-sm font-semibold text-success">{message}</p> : null}
            {error ? <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p> : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-text-secondary">E-mail</span>
              <ControlInput
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="twoj@email.pl"
                className="min-h-12 w-full rounded-xl border border-border-custom bg-surface-solid px-3.5 text-base text-text-primary transition-[background-color,border-color,box-shadow] placeholder:text-text-muted/50 focus:border-primary/45"
              />
            </label>

            {mode !== 'reset' ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-text-secondary">Hasło</span>
                <ControlInput
                  type="password"
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="min-h-12 w-full rounded-xl border border-border-custom bg-surface-solid px-3.5 text-base text-text-primary transition-[background-color,border-color,box-shadow] placeholder:text-text-muted/50 focus:border-primary/45"
                />
              </label>
            ) : null}

            <Pressable type="submit" variant="primary" size="lg" loading={loading} icon={<LockKeyhole size={16} />} className="mt-2 w-full">
              {COPY[mode].submit}
            </Pressable>
          </form>

          <nav aria-label="Opcje logowania" className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold">
            {mode !== 'signin' ? <Pressable onClick={() => changeMode('signin')} className="text-text-muted hover:text-primary">Logowanie</Pressable> : null}
            {mode !== 'signup' ? <Pressable onClick={() => changeMode('signup')} className="text-text-muted hover:text-primary">Utwórz konto</Pressable> : null}
            {mode !== 'reset' ? <Pressable onClick={() => changeMode('reset')} className="text-text-muted hover:text-primary">Nie pamiętam hasła</Pressable> : null}
          </nav>
        </div>
        <p className="mt-5 text-center text-xs text-text-muted">Twoje dane pozostają prywatne i przypisane do Twojego konta.</p>
      </section>
    </main>
  );
}
