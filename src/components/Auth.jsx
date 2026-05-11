import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Dumbbell } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Konto utworzone! Możesz się teraz zalogować.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-neutral-800">
            <Dumbbell className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase">Kuba Workout</h1>
          <p className="text-neutral-500 text-sm mt-1">12-tygodniowy plan rekompozycji</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">{error}</div>}
          
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="trening@kuba.pl"
            />
          </div>
          <div>
            <label className="label">Hasło</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Ładowanie...' : (isLogin ? 'Zaloguj się' : 'Zarejestruj się')}
          </button>
        </form>

        <div className="mt-6 text-center opacity-0 pointer-events-none">
          {/* Registration disabled */}
        </div>
      </div>
    </div>
  );
}
