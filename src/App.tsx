import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Auth from './components/core/Auth';
import Dashboard from './components/core/Dashboard';
import NotFoundPage from './components/core/NotFoundPage';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { ToastHost } from './components/ui/ToastHost';
import SettingsView from './components/settings/SettingsView';

const DesktopDashboard = lazy(() => import('./components/desktop/DesktopDashboard'));
const GrowthView = lazy(() => import('./components/growth/GrowthView'));
const MedicalStudiesPage = lazy(() => import('./components/medical/MedicalStudiesPage'));
const CorrelationsPage = lazy(() => import('./components/correlations/CorrelationsPage'));
const EndMyopiaCalculator = lazy(() => import('./components/medical/EndMyopiaCalculator'));

function KorelacjeRedirect() {
  return <Navigate to="/korealcje" replace />;
}

function KeepRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') try { localStorage.setItem('vanguard_keep_new', '1'); } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
    try { localStorage.setItem('vanguard_view', 'keep'); } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
  }, []);
  return <Navigate to="/" replace />;
}

function AppRoutes() {
    const { session, setSession, fetchUserSettings } = useStore();
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserSettings();
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserSettings();
    });
    return () => subscription.unsubscribe();
  }, [setSession, fetchUserSettings]);

  useEffect(() => {
    if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[sw] Registered successfully:', reg.scope))
        .catch((err) => console.error('[sw] Registration failed:', err));
    }
  }, []);

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
      <Route path="/settings" element={<SettingsView session={session} />} />
      <Route path="/rozwoj" element={
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
          <GrowthView session={session} />
        </Suspense>
      } />
      <Route path="/badania" element={
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
          <MedicalStudiesPage session={session} />
        </Suspense>
      } />
      <Route path="/korealcje" element={
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
          <CorrelationsPage session={session} />
        </Suspense>
      } />
      <Route path="/korelacje" element={<KorelacjeRedirect />} />
      <Route path="/optics" element={
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
          <EndMyopiaCalculator />
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
        <ToastHost />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
