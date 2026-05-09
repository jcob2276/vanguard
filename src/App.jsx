import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { useNotifications } from './hooks/useNotifications';

function App() {
  const { session, setSession } = useStore();
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {!session ? (
        <Auth />
      ) : (
        <Dashboard session={session} />
      )}
    </>
  );
}

export default App;
