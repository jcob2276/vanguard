import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Auth from './components/core/Auth';
import Dashboard from './components/core/Dashboard';
import NotFoundPage from './components/core/NotFoundPage';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/core/ErrorBoundary';

const DesktopDashboard = lazy(() => import('./components/desktop/DesktopDashboard'));

function KeepRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('new') === '1') localStorage.setItem('vanguard_keep_new', '1');
  localStorage.setItem('vanguard_view', 'keep');
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { session, setSession } = useStore();
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [setSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard session={session} />} />
      <Route path="/keep" element={<KeepRedirect />} />

      <Route path="/dashboard" element={
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
          <DesktopDashboard session={session} />
        </Suspense>
      } />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
