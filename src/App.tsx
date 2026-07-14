import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Auth from './components/core/Auth';
import Dashboard from './components/core/Dashboard';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { ToastHost } from './components/ui/ToastHost';
import SettingsView from './components/settings/SettingsView';
import PageTemplateBoundary, { type PageTemplateKind } from './components/shared/PageTemplateBoundary';

const DesktopDashboard = lazy(() => import('./components/desktop/shell/DesktopDashboard'));
const GrowthView = lazy(() => import('./components/growth/GrowthView'));
const MedicalStudiesPage = lazy(() => import('./components/medical/MedicalStudiesPage'));
const CorrelationsPage = lazy(() => import('./components/correlations/CorrelationsPage'));
const EndMyopiaCalculator = lazy(() => import('./components/medical/EndMyopiaCalculator'));
const DesignSystemPage = lazy(() => import('./components/dev/DesignSystemPage'));

const FALLBACK_SPINNER = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
  </div>
);

function KorealcjeRedirect() {
  return <Navigate to="/korelacje" replace />;
}

function Screen({ kind, children }: { kind: PageTemplateKind; children: ReactNode }) {
  return <PageTemplateBoundary kind={kind}>{children}</PageTemplateBoundary>;
}

function AppRoutes() {
  const { session, setSession, fetchUserSettings } = useStore();
  const [loading, setLoading] = useState(true);
  const location = useLocation();

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
        .then((reg) => console.debug('[sw] Registered successfully:', reg.scope))
        .catch((err) => console.error('[sw] Registration failed:', err));
    }
  }, []);

  if (loading) {
    return FALLBACK_SPINNER;
  }

  if (import.meta.env.DEV && location.pathname === '/dev/design-system') {
    return (
      <Suspense fallback={FALLBACK_SPINNER}>
        <DesignSystemPage />
      </Suspense>
    );
  }

  if (!session) return <Auth />;

  return (
    <Routes>
      <Route path="/" element={<Screen kind="dashboard"><Dashboard session={session} /></Screen>} />
      <Route path="/dzis" element={<Screen kind="dashboard"><Dashboard session={session} /></Screen>} />
      <Route path="/tydzien" element={<Screen kind="dashboard"><Dashboard session={session} /></Screen>} />
      <Route path="/projekty" element={<Screen kind="grid"><Dashboard session={session} /></Screen>} />
      <Route path="/historia" element={<Screen kind="list"><Dashboard session={session} /></Screen>} />
      <Route path="/keep" element={<Screen kind="grid"><Dashboard session={session} /></Screen>} />
      <Route path="/todo" element={<Screen kind="list"><Dashboard session={session} /></Screen>} />
      <Route path="/kalendarz" element={<Screen kind="timeline"><Dashboard session={session} /></Screen>} />
      <Route path="/links" element={<Screen kind="list"><Dashboard session={session} /></Screen>} />
      <Route path="/fundament" element={<Screen kind="dashboard"><Dashboard session={session} /></Screen>} />
      <Route path="/trening" element={<Screen kind="list"><Dashboard session={session} /></Screen>} />
      <Route path="/sauna" element={<Screen kind="list"><Dashboard session={session} /></Screen>} />

      <Route path="/dashboard" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="dashboard"><DesktopDashboard session={session} /></Screen>
        </Suspense>
      } />
      <Route path="/settings" element={<Screen kind="list"><SettingsView session={session} /></Screen>} />
      <Route path="/rozwoj" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="dashboard"><GrowthView session={session} /></Screen>
        </Suspense>
      } />
      <Route path="/badania" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="list"><MedicalStudiesPage /></Screen>
        </Suspense>
      } />
      <Route path="/korelacje" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="dashboard"><CorrelationsPage /></Screen>
        </Suspense>
      } />
      <Route path="/korealcje" element={<KorealcjeRedirect />} />
      <Route path="/optics" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="list"><EndMyopiaCalculator /></Screen>
        </Suspense>
      } />
      <Route path="/dev/design-system" element={
        <Suspense fallback={FALLBACK_SPINNER}>
          <Screen kind="grid"><DesignSystemPage /></Screen>
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
