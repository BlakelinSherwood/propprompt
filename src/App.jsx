import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import PlatformAdmin from './pages/PlatformAdmin';
import NewAnalysis from './pages/NewAnalysis';
import AnalysisDetail from './pages/AnalysisDetail';
import AnalysisRun from './pages/AnalysisRun';
import Analyses from './pages/Analyses';
import Billing from './pages/Billing';
import Landing from './pages/Landing.jsx';
import BrokerageAdmin from './pages/BrokerageAdmin';
import TeamAdmin from './pages/TeamAdmin';
import AccountSettings from './pages/AccountSettings';
import AgentBranding from './pages/AgentBranding';
import PricingAdmin from './pages/PricingAdmin';
import PlatformSettings from './pages/admin/PlatformSettings';
import Territories from './pages/Territories';
import Claim from './pages/Claim';
import TopupPage from './pages/TopupPage';
import BundleManagement from './pages/BundleManagement';
import PoolManagement from './pages/PoolManagement';
import ClaimsAdmin from './pages/admin/ClaimsAdmin';
import ClaimSubmitted from './pages/ClaimSubmitted';
import BrokerageBranding from './pages/BrokerageBranding';
import TeamBranding from './pages/TeamBranding';
import Training from './pages/Training';
import TrainingVideo from './pages/TrainingVideo';
import TrainingAdmin from './pages/admin/TrainingAdmin';
import EasternMA from './pages/admin/territories/EasternMA';
import DataQuality from './pages/admin/DataQuality';
import AlertSettings from './pages/AlertSettings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#FAF8F4]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1A3226] flex items-center justify-center text-[#B8982F] font-bold text-sm">
            PP
          </div>
          <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/app" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Members" element={<Members />} />
        <Route path="/PlatformAdmin" element={<PlatformAdmin />} />
        <Route path="/NewAnalysis" element={<NewAnalysis />} />
        <Route path="/Analysis/:id" element={<AnalysisDetail />} />
        <Route path="/AnalysisRun" element={<AnalysisRun />} />
        <Route path="/Analyses" element={<Analyses />} />
        <Route path="/Billing" element={<Billing />} />
        <Route path="/brokerage/:id/admin" element={<BrokerageAdmin />} />
        <Route path="/brokerage/:id/branding" element={<BrokerageBranding />} />
        <Route path="/team/:id/admin" element={<TeamAdmin />} />
        <Route path="/team/:id/branding" element={<TeamBranding />} />
        <Route path="/AccountSettings" element={<AccountSettings />} />
        <Route path="/settings/branding" element={<AgentBranding />} />
        <Route path="/admin/pricing" element={<PricingAdmin />} />
        <Route path="/admin/settings" element={<PlatformSettings />} />
        <Route path="/admin/claims" element={<ClaimsAdmin />} />
        <Route path="/admin/training" element={<TrainingAdmin />} />
        <Route path="/admin/data-quality" element={<DataQuality />} />
        <Route path="/admin/territories/eastern-ma" element={<EasternMA />} />
        <Route path="/account/alert-settings" element={<AlertSettings />} />
        <Route path="/training" element={<Training />} />
        <Route path="/training/:videoId" element={<TrainingVideo />} />
        <Route path="/Territories" element={<Territories />} />
        <Route path="/account/topup" element={<TopupPage />} />
        <Route path="/account/bundle/:bundle_id" element={<BundleManagement />} />
        <Route path="/account/pool/:pool_id" element={<PoolManagement />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/claim/submitted" element={<ClaimSubmitted />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/Landing" element={<Landing />} />
            <Route path="/" element={<Navigate to="/Landing" replace />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App