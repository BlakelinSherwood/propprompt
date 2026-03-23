import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { Users, FileText, Shield, Activity, ArrowRight, PlusCircle } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import DashboardStatCard from "../components/DashboardStatCard";
import WelcomeHero from "../components/WelcomeHero";
import TrainingProgressWidget from "../components/training/TrainingProgressWidget";
import FairHousingBanner from "../components/FairHousingBanner";
import PrivacyNoticeModal from "../components/PrivacyNoticeModal";
import OnboardingWelcomeModal from "../components/OnboardingWelcomeModal";
import { base44 } from "@/api/base44Client";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [userCount, setUserCount] = useState(null);
  const [analysisCount, setAnalysisCount] = useState(null);
  const [fhStatus, setFhStatus] = useState(null);
  const [marketLabel, setMarketLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      // Safety timeout — never spin forever on mobile
      const timeout = setTimeout(() => setLoading(false), 8000);
      try {
        if (!user.privacy_notice_accepted_at) setShowPrivacyNotice(true);

        // Resolve subscribed territory names for the subtitle
        try {
          if (user.role === 'platform_owner') {
            setMarketLabel(null);
          } else {
            const subs = await base44.entities.TerritorySubscription.filter({ user_id: user.id, status: 'active' });
            if (subs.length > 0) {
              const territoryIds = [...new Set(subs.map(s => s.territory_id))];
              const territories = await Promise.all(
                territoryIds.slice(0, 5).map(id => base44.entities.Territory.filter({ id }))
              );
              const names = territories.flatMap(t => t).map(t => t.city_town).filter(Boolean);
              if (names.length > 0) {
                setMarketLabel(names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to load territory subscriptions:', e);
        }

        const isAdmin = user.role === "platform_owner" || user.role === "brokerage_admin" || user.role === "team_lead";
        if (isAdmin) {
          try {
            const [users, analyses] = await Promise.all([
              base44.entities.User.list('', 500),
              base44.entities.Analysis.list("-created_date", 200),
            ]);
            setUserCount(users.length);
            setAnalysisCount(analyses.length);
          } catch (err) {
            console.warn('Failed to load admin stats:', err);
          }
        }

        if (user.role === "brokerage_admin" || user.role === "team_lead") {
          try {
            const reviews = await base44.entities.FairHousingReview.filter({ reviewer_email: user.email });
            const current = {
              signed: reviews.filter((r) => r.status === "signed").length,
              overdue: reviews.filter((r) => r.status === "overdue").length,
              pending: reviews.filter((r) => r.status === "pending" || r.status === "viewed").length,
            };
            setFhStatus(current);
          } catch (err) {
            console.warn('Failed to load fair housing status:', err);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === "platform_owner" || user?.role === "brokerage_admin" || user?.role === "team_lead";
  const complianceLabel = fhStatus
    ? fhStatus.overdue > 0 ? `${fhStatus.overdue} overdue` : fhStatus.pending > 0 ? `${fhStatus.pending} pending` : "Up to date"
    : "—";
  const complianceSubtitle = fhStatus?.overdue > 0 ? "Action required" : fhStatus?.pending > 0 ? "Signature needed" : fhStatus ? "All signed" : "Coming soon";

  return (
    <>
      {showPrivacyNotice && (
        <PrivacyNoticeModal
          user={user}
          onAccepted={() => {
            setShowPrivacyNotice(false);
          }}
        />
      )}
      {user && <OnboardingWelcomeModal user={user} onClose={() => {}} />}

      <div className="space-y-6">
        {/* Fair housing overdue banner — only for brokerage_admin / team_lead */}
        <FairHousingBanner user={user} />

        <WelcomeHero user={user} roleLabel={ROLE_LABELS[user?.role]} marketLabel={marketLabel} />

        {/* Quick Stats */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStatCard
              icon={Users}
              label="Team Members"
              value={userCount ?? "—"}
              linkTo="/Members"
            />
            <DashboardStatCard
              icon={FileText}
              label="Analyses Run"
              value={analysisCount ?? "—"}
              linkTo="/Analyses"
            />
            <DashboardStatCard
              icon={Activity}
              label="This Month"
              value="—"
              subtitle="Coming soon"
            />
            <DashboardStatCard
              icon={Shield}
              label="Compliance"
              value={complianceLabel}
              subtitle={complianceSubtitle}
            />
          </div>
        )}

        <TrainingProgressWidget user={user} />

        {/* Getting Started */}
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-[#1A3226] mb-1">Getting Started</h2>
          <p className="text-sm text-[#1A3226]/60 mb-6">
            {marketLabel
              ? `PropPrompt™ is your AI-calibrated real estate analysis system for ${marketLabel}.`
              : "PropPrompt™ is your AI-calibrated real estate analysis system."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isAdmin && (
              <Link
                to="/Members"
                className="group flex items-start gap-4 p-4 rounded-xl border border-[#1A3226]/10 hover:border-[#B8982F]/40 hover:bg-[#B8982F]/5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#B8982F]/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[#B8982F]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A3226] group-hover:text-[#B8982F] transition-colors">
                    Invite Team Members
                  </p>
                  <p className="text-xs text-[#1A3226]/50 mt-0.5">Add agents, assistants, and team leads to your organization.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#1A3226]/20 group-hover:text-[#B8982F] transition-colors mt-0.5" />
              </Link>
            )}
            <Link
              to="/NewAnalysis"
              className="group flex items-start gap-4 p-4 rounded-xl border border-[#1A3226]/10 hover:border-[#B8982F]/40 hover:bg-[#B8982F]/5 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1A3226]/5 flex items-center justify-center flex-shrink-0">
                <PlusCircle className="w-5 h-5 text-[#1A3226]/60 group-hover:text-[#B8982F] transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1A3226] group-hover:text-[#B8982F] transition-colors">Run an Analysis</p>
                <p className="text-xs text-[#1A3226]/50 mt-0.5">Pricing, buyer intel, CMAs, investment analysis — all AI-powered.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#1A3226]/20 group-hover:text-[#B8982F] transition-colors mt-0.5" />
            </Link>
            {(user?.role === "brokerage_admin" || user?.role === "team_lead") && (
              <div
                className="flex items-start gap-4 p-4 rounded-xl border border-[#1A3226]/10 cursor-pointer hover:border-[#1A3226]/20 transition-all"
                onClick={() => {}}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${fhStatus?.overdue ? "bg-red-50" : "bg-[#1A3226]/5"}`}>
                  <Shield className={`w-5 h-5 ${fhStatus?.overdue ? "text-red-500" : "text-[#1A3226]/40"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A3226]">Fair Housing Compliance</p>
                  <p className="text-xs text-[#1A3226]/50 mt-0.5">
                    {fhStatus?.overdue
                      ? `${fhStatus.overdue} review${fhStatus.overdue !== 1 ? "s" : ""} need your signature.`
                      : fhStatus?.pending
                      ? "Monthly review ready to sign."
                      : "Monthly compliance reviews — auto-generated."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}