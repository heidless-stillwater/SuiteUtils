import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeployConsolePage } from './pages/DeployConsolePage';
import { DeployHistoryPage } from './pages/DeployHistoryPage';
import { ThemeStudioPage } from './pages/ThemeStudioPage';
import { SettingsPage } from './pages/SettingsPage';
import { PricingPage } from './pages/PricingPage';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-white/30 text-sm">Loading SuiteUtils...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[260px] transition-all duration-300">
        <TopBar />
        <main className="p-8 pb-24">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/deploy" element={<DeployConsolePage />} />
            <Route path="/history" element={<DeployHistoryPage />} />
            <Route path="/themes" element={<ThemeStudioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
