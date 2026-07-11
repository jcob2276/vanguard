import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Auth from './components/core/Auth';
import Dashboard from './components/core/Dashboard';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { ToastHost } from './components/ui/ToastHost';
import SettingsView from './components/settings/SettingsView';

const DesktopDashboard = lazy(() => import('./components/desktop/shell/DesktopDashboard'));
const GrowthView = lazy(() => import('./components/growth/GrowthView'));
const MedicalStudiesPage = lazy(() => import('./components/medical/MedicalStudiesPage'));
const CorrelationsPage = lazy(() => import('./components/correlations/CorrelationsPage'));
const EndMyopiaCalculator = lazy(() => import('./components/medical/EndMyopiaCalculator'));

const FALLBACK_SPINNER = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
  </div>
);

function KorealcjeRedirect() {
  return <Navigate to="/korelacje" replace />;
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
    return FALLBACK_SPINNER;
  }

  if (!session) return <Auth />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard session={session} />} />
      <Route path="/dzis" element={<Dashboard session={session} />} />
      <Route path="/tydzien" element={<Dashboard session={session} />} />
      <Route path="/projekty" element={<Dashboard session={session} />} />
      <Route path="/historia" element={<Dashboard session={session} />} />
      <Route path="/keep" element={<Dashboard session={session} />} />
      <Route path="/todo" element={<Dashboard session={session} />} />
      <Route path="/kalendarz" element={<Dashboard session={session} />} />
      <Route path="/links" element={<Dashboard session={session} />} />
      <Route path="/fundament" element={<Dashboard session={session} />} />
      <Route path="/trening" element={<Dashboard session={session} />} />
      <Route path="/sauna" element={<Dashboard session={session} />} />

      <Route path="/dashboard" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <DesktopDashboard session={session} />
        </Suspense>
      } />
      <Route path="/settings" element={<SettingsView session={session} />} />
      <Route path="/rozwoj" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <GrowthView session={session} />
        </Suspense>
      } />
      <Route path="/badania" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <MedicalStudiesPage />
        </Suspense>
      } />
      <Route path="/korelacje" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <CorrelationsPage />
        </Suspense>
      } />
      <Route path="/korealcje" element={<KorealcjeRedirect />} />
      <Route path="/optics" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <EndMyopiaCalculator />
        </Suspense>
      } />
      <Route path="*" element={<Navigate to="/dzis" replace />} />
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
