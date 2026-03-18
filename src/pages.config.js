/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccountSettings from './pages/AccountSettings';
import AgentBranding from './pages/AgentBranding';
import AlertSettings from './pages/AlertSettings';
import Analyses from './pages/Analyses';
import AnalysisDetail from './pages/AnalysisDetail';
import AnalysisRun from './pages/AnalysisRun';
import Billing from './pages/Billing';
import BrokerageAdmin from './pages/BrokerageAdmin';
import BrokerageBranding from './pages/BrokerageBranding';
import BundleManagement from './pages/BundleManagement';
import Claim from './pages/Claim';
import ClaimSubmitted from './pages/ClaimSubmitted';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Members from './pages/Members';
import NewAnalysis from './pages/NewAnalysis';
import PlatformAdmin from './pages/PlatformAdmin';
import PoolManagement from './pages/PoolManagement';
import PricingAdmin from './pages/PricingAdmin';
import TeamAdmin from './pages/TeamAdmin';
import TeamBranding from './pages/TeamBranding';
import Territories from './pages/Territories';
import TopupPage from './pages/TopupPage';
import Training from './pages/Training';
import TrainingVideo from './pages/TrainingVideo';
import AdminDigest from './pages/AdminDigest';
import ClaimsAdmin from './pages/ClaimsAdmin';
import DataQuality from './pages/DataQuality';
import EasternMAAdmin from './pages/EasternMAAdmin';
import FounderProfileSettings from './pages/FounderProfileSettings';
import PlatformSettings from './pages/PlatformSettings';
import PricingAdmin from './pages/PricingAdmin';
import TrainingAdmin from './pages/TrainingAdmin';
import EasternMA from './pages/EasternMA';


export const PAGES = {
    "AccountSettings": AccountSettings,
    "AgentBranding": AgentBranding,
    "AlertSettings": AlertSettings,
    "Analyses": Analyses,
    "AnalysisDetail": AnalysisDetail,
    "AnalysisRun": AnalysisRun,
    "Billing": Billing,
    "BrokerageAdmin": BrokerageAdmin,
    "BrokerageBranding": BrokerageBranding,
    "BundleManagement": BundleManagement,
    "Claim": Claim,
    "ClaimSubmitted": ClaimSubmitted,
    "Dashboard": Dashboard,
    "Landing": Landing,
    "Members": Members,
    "NewAnalysis": NewAnalysis,
    "PlatformAdmin": PlatformAdmin,
    "PoolManagement": PoolManagement,
    "PricingAdmin": PricingAdmin,
    "TeamAdmin": TeamAdmin,
    "TeamBranding": TeamBranding,
    "Territories": Territories,
    "TopupPage": TopupPage,
    "Training": Training,
    "TrainingVideo": TrainingVideo,
    "AdminDigest": AdminDigest,
    "ClaimsAdmin": ClaimsAdmin,
    "DataQuality": DataQuality,
    "EasternMAAdmin": EasternMAAdmin,
    "FounderProfileSettings": FounderProfileSettings,
    "PlatformSettings": PlatformSettings,
    "PricingAdmin": PricingAdmin,
    "TrainingAdmin": TrainingAdmin,
    "EasternMA": EasternMA,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
};