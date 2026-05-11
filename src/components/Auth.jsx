import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Fingerprint, Lock, Zap } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setError(error.message === 'Invalid login credentials' ? 'Błędne poświadczenia dostępu.' : error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,20,1)_0%,rgba(0,0,0,1)_100%)]"></div>
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-1000">
        <div className="bg-neutral-900/40 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-2xl shadow-black">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 border border-primary/20 relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <Fingerprint className="text-primary relative z-10 animate-pulse" size={40} />
            </div>
            <h1 className="text-3xl font-black tracking-[-0.05em] text-white uppercase italic">Vanguard OS <span className="text-primary not-italic text-sm align-top ml-1">v3.0</span></h1>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Identity Verification Required</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Access ID</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-6 text-sm text-white focus:border-primary/50 transition-all outline-none placeholder:text-neutral-800 font-bold"
                  placeholder="name@vanguard.sys"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Secure Key</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-6 text-sm text-white focus:border-primary/50 transition-all outline-none placeholder:text-neutral-800 font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-primary hover:bg-primary/90 text-black rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] transition-all transform active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-3 mt-4"
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

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-600">
              <Shield size={12} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Encrypted Connection Active</p>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[8px] font-black text-neutral-700 uppercase tracking-[0.5em]">
          Authorized Personnel Only • Neural Link 3.1
        </p>
      </div>
    </div>
  );
}
