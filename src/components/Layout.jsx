import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  Shield,
  FileText,
  PlusCircle,
  CreditCard,
  Settings,
  GraduationCap,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FairHousingOverdueBanner from "./FairHousingOverdueBanner";
import PrivacyNoticeModal from "./PrivacyNoticeModal";
import ChatbotDrawer from "./ChatbotDrawer";
import BackButton from "./BackButton";

const PLATFORM_OWNER_EMAIL = "blake.sherwood@compass.com";

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  brokerage_admin: "Brokerage Admin",
  team_lead: "Team Lead",
  agent: "Agent",
  assistant: "Assistant",
  team_agent: "Team Agent",
};

// Tab roots for stack preservation
const TAB_ROOTS = ["/Dashboard", "/NewAnalysis", "/Analyses", "/training", "/AccountSettings"];

function getTabRoot(pathname) {
  return TAB_ROOTS.find(r => pathname === r || pathname.startsWith(r + "/")) || null;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const tabStacks = useRef(Object.fromEntries(TAB_ROOTS.map(r => [r, r])));

  useEffect(() => {
    base44.auth.me().then((me) => {
      setUser(me);
      if (!me?.privacy_notice_accepted_at) setShowPrivacyNotice(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const root = getTabRoot(location.pathname);
    if (root) tabStacks.current[root] = location.pathname;
  }, [location.pathname]);

  function navigateTab(tabRoot) {
    navigate(tabStacks.current[tabRoot] || tabRoot);
  }

  const isAdmin = user?.role === "platform_owner" || user?.role === "brokerage_admin" || user?.role === "team_lead";
  const BRANDING_ROLES = ["team_lead", "brokerage_owner", "platform_owner"];
  const canAccessBranding = BRANDING_ROLES.includes(user?.role);

  const navItems = [
    { label: "Dashboard", path: "/Dashboard", icon: LayoutDashboard },
    { label: "New Analysis", path: "/NewAnalysis", icon: PlusCircle },
    { label: "Analyses", path: "/Analyses", icon: FileText },
    ...(isAdmin ? [{ label: "Members", path: "/Members", icon: Users }] : []),
    ...(isAdmin ? [{ label: "Billing", path: "/Billing", icon: CreditCard }] : []),
    ...(user?.role === "platform_owner" ? [{ label: "Platform Admin", path: "/PlatformAdmin", icon: Shield }] : []),
    ...(canAccessBranding ? [{ label: "Branding", path: "/admin/branding", icon: Palette }] : []),
    { label: "Training", path: "/training", icon: GraduationCap },
    { label: "Account Settings", path: "/AccountSettings", icon: Settings },
  ];

  const handleLogout = () => {
    base44.auth.logout("/");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      {showPrivacyNotice && (
        <PrivacyNoticeModal
          user={user}
          onAccepted={() => {
            setShowPrivacyNotice(false);
            setUser((u) => ({ ...u, privacy_notice_accepted_at: new Date().toISOString() }));
          }}
        />
      )}
      <style>{`
        :root {
          --pp-green: #1A3226;
          --pp-gold: #B8982F;
          --pp-cream: #FAF8F4;
        }
      `}</style>

      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#1A3226] text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between h-16 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="hidden lg:block p-1.5 rounded-md hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/Dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-sm">
                PP
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-semibold tracking-tight">PropPrompt</span>
                <span className="text-[#B8982F] text-xs ml-1">™</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-white/70">{user.full_name || user.email}</span>
                <span className="text-[10px] uppercase tracking-wider bg-[#B8982F]/20 text-[#B8982F] px-2 py-0.5 rounded-full font-medium">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 min-h-[calc(100vh-4rem)] bg-[#1A3226]/[0.03] border-r border-[#1A3226]/10">
          <nav className="flex-1 px-3 py-6 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path || (item.path === '/training' && location.pathname.startsWith('/training'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${active
                      ? "bg-[#1A3226] text-white shadow-sm"
                      : "text-[#1A3226]/70 hover:bg-[#1A3226]/5 hover:text-[#1A3226]"
                    }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 pb-6">
            <div className="px-3 py-3 rounded-lg bg-[#1A3226]/5 text-xs text-[#1A3226]/50">
              <p className="font-medium text-[#1A3226]/70">Sherwood & Company</p>
              <p>Brokered by Compass</p>
            </div>
          </div>
        </aside>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-16 bottom-0 w-64 bg-white shadow-xl">
              <nav className="px-3 py-6 space-y-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${active
                          ? "bg-[#1A3226] text-white shadow-sm"
                          : "text-[#1A3226]/70 hover:bg-[#1A3226]/5 hover:text-[#1A3226]"
                        }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)]">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            <BackButton />
            <FairHousingOverdueBanner user={user} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ x: 18, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -18, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      
      </div>

      {/* Bottom Navigation — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#1A3226]/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around">
          {[
            { label: "Home", path: "/Dashboard", icon: LayoutDashboard },
            { label: "New", path: "/NewAnalysis", icon: PlusCircle },
            { label: "Analyses", path: "/Analyses", icon: FileText },
            { label: "Training", path: "/training", icon: GraduationCap },
            { label: "Account", path: "/AccountSettings", icon: Settings },
          ].map((item) => {
            const active = location.pathname === item.path || (item.path === '/training' && location.pathname.startsWith('/training'));
            return (
              <button
                key={item.path}
                onClick={() => navigateTab(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[56px] px-3 transition-colors ${
                  active ? "text-[#1A3226]" : "text-[#1A3226]/40"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* PropBot floating chatbot */}
      <ChatbotDrawer user={user} />
    </div>
  );
}