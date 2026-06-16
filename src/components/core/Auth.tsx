import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Fingerprint, Lock, Zap } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync theme with document class on mount
  useEffect(() => {
    const theme = localStorage.getItem('vanguard_theme') || 'light';
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
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setError(msg === 'Invalid login credentials' ? 'Błędne poświadczenia dostępu.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-background/50"></div>
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/3 rounded-full blur-[120px] opacity-20"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-1000">
        <div className="bg-surface/55 border border-border-custom backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-lg">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-6 border border-primary/20 relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-[24px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <Fingerprint className="text-primary relative z-10 animate-pulse" size={40} />
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight text-text-primary uppercase italic">
              Vanguard OS <span className="text-primary not-italic text-sm align-top ml-1">v3.0</span>
            </h1>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.4em] mt-2">Identity Verification Required</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4">Access ID</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-2xl py-4 px-6 text-sm text-text-primary focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all outline-none placeholder:text-text-muted/40 font-bold"
                  placeholder="name@vanguard.sys"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4">Secure Key</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-2xl py-4 px-6 text-sm text-text-primary focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all outline-none placeholder:text-text-muted/40 font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-primary hover:bg-primary-hover text-white rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] transition-all transform active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/25 flex items-center justify-center gap-3 mt-4 cursor-pointer"
            >
              {loading ? (
                <Zap size={18} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  Inicjuj Sesję
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-border-custom text-center">
            <div className="flex items-center justify-center gap-2 text-text-muted">
              <Shield size={12} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Encrypted Connection Active</p>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[8px] font-black text-text-muted/50 uppercase tracking-[0.5em]">
          Authorized Personnel Only • Neural Link 3.1
        </p>
      </div>
    </div>
  );
}
