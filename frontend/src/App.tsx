import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { PageSpinner } from './components/ui';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DossiersPage = lazy(() => import('./pages/DossiersPage'));
const DossierDetailPage = lazy(() => import('./pages/DossierDetailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const DerogationPage = lazy(() => import('./pages/DerogationPage'));
const CommercialPage = lazy(() => import('./pages/CommercialPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <PageSpinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <PageSpinner />
      </div>
    );
  }

  const isCommercial = user?.role === 'commercial';

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <PageSpinner />
        </div>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={isCommercial ? <Navigate to="/mes-dossiers" replace /> : <DossiersPage />} />
          <Route path="dossiers" element={<DossiersPage />} />
          <Route path="dossiers/:id" element={<DossierDetailPage />} />
          <Route path="mes-dossiers" element={<CommercialPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="alertes" element={<AlertsPage />} />
          <Route path="derogation" element={<DerogationPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
