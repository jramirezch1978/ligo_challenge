import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';

function AppShell() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ToastProvider>
  );
}
