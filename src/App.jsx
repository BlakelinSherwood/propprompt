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

const ProtectedRoute = ({ element, requiresAuth = true, requiresSubscription = false }) => {
  const { isAuthenticated, hasActiveSubscription, isLoadingAuth } = useAuth();
  
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#FAF8F4]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1A3226] flex items-center justify-center text-[#B8982F] font-bold text-sm">PP</div>
          <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  
  if (!requiresAuth) return element;
  
  if (!isAuthenticated) {
    return <Navigate to="/Landing" replace />;
  }
  
  if (requiresSubscription && !hasActiveSubscription) {
    return <Navigate to="/Claim" replace />;
  }
  
  return element;
};

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
      <Route path="/" element={<Navigate to="/Landing" replace />} />
      <Route path="/app" element={<Navigate to="/Dashboard" replace />} />
      <Route path="/app/*" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<ProtectedRoute element={<Dashboard />} requiresAuth={true} requiresSubscription={false} />} />
        <Route path="/Members" element={<ProtectedRoute element={<Members />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/PlatformAdmin" element={<ProtectedRoute element={<PlatformAdmin />} requiresAuth={true} />} />
        <Route path="/NewAnalysis" element={<ProtectedRoute element={<NewAnalysis />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/Analysis/:id" element={<ProtectedRoute element={<AnalysisDetail />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/AnalysisRun" element={<ProtectedRoute element={<AnalysisRun />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/Analyses" element={<ProtectedRoute element={<Analyses />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/Billing" element={<ProtectedRoute element={<Billing />} requiresAuth={true} />} />
        <Route path="/brokerage/:id/admin" element={<ProtectedRoute element={<BrokerageAdmin />} requiresAuth={true} />} />
        <Route path="/brokerage/:id/branding" element={<ProtectedRoute element={<BrokerageBranding />} requiresAuth={true} />} />
        <Route path="/team/:id/admin" element={<ProtectedRoute element={<TeamAdmin />} requiresAuth={true} />} />
        <Route path="/team/:id/branding" element={<ProtectedRoute element={<TeamBranding />} requiresAuth={true} />} />
        <Route path="/AccountSettings" element={<ProtectedRoute element={<AccountSettings />} requiresAuth={true} />} />
        <Route path="/settings/branding" element={<ProtectedRoute element={<AgentBranding />} requiresAuth={true} />} />
        <Route path="/admin/pricing" element={<ProtectedRoute element={<PricingAdmin />} requiresAuth={true} />} />
        <Route path="/admin/settings" element={<ProtectedRoute element={<PlatformSettings />} requiresAuth={true} />} />
        <Route path="/admin/claims" element={<ProtectedRoute element={<ClaimsAdmin />} requiresAuth={true} />} />
        <Route path="/admin/training" element={<ProtectedRoute element={<TrainingAdmin />} requiresAuth={true} />} />
        <Route path="/admin/data-quality" element={<ProtectedRoute element={<DataQuality />} requiresAuth={true} />} />
        <Route path="/admin/territories/eastern-ma" element={<ProtectedRoute element={<EasternMA />} requiresAuth={true} />} />
        <Route path="/account/alert-settings" element={<ProtectedRoute element={<AlertSettings />} requiresAuth={true} />} />
        <Route path="/training" element={<ProtectedRoute element={<Training />} requiresAuth={true} />} />
        <Route path="/training/:videoId" element={<ProtectedRoute element={<TrainingVideo />} requiresAuth={true} />} />
        <Route path="/Territories" element={<ProtectedRoute element={<Territories />} requiresAuth={false} />} />
        <Route path="/account/topup" element={<ProtectedRoute element={<TopupPage />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/account/bundle/:bundle_id" element={<ProtectedRoute element={<BundleManagement />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/account/pool/:pool_id" element={<ProtectedRoute element={<PoolManagement />} requiresAuth={true} requiresSubscription={true} />} />
        <Route path="/Claim" element={<ProtectedRoute element={<Claim />} requiresAuth={true} requiresSubscription={false} />} />
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