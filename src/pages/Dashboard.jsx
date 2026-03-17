import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, FileText, Shield, Activity, ArrowRight, PlusCircle } from "lucide-react";
import DashboardStatCard from "../components/DashboardStatCard";
import WelcomeHero from "../components/WelcomeHero";
import TrainingProgressWidget from "../components/training/TrainingProgressWidget";
import FairHousingBanner from "../components/FairHousingBanner";
import PrivacyNoticeModal from "../components/PrivacyNoticeModal";
import OnboardingWelcomeModal from "../components/OnboardingWelcomeModal";

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  brokerage_admin: "Brokerage Admin",
  team_lead: "Team Lead",
  agent: "Agent",
  assistant: "Assistant",
  team_agent: "Team Agent",
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [analysisCount, setAnalysisCount] = useState(null);
  const [fhStatus, setFhStatus] = useState(null); // { signed, overdue, pending }
  const [loading, setLoading] = useState(true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        setUser(me);

        // Show privacy notice if never accepted
        if (!me.privacy_notice_accepted_at) {
          setShowPrivacyNotice(true);
        }

        const isAdmin = me.role === "platform_owner" || me.role === "brokerage_admin" || me.role === "team_lead";
        if (isAdmin) {
          const [users, analyses] = await Promise.all([
            base44.entities.User.list(),
            base44.entities.Analysis.list("-created_date", 200),
          ]);
          setUserCount(users.length);
          setAnalysisCount(analyses.length);
        }

        // Fair housing status for brokerage_admin / team_lead
        if (me.role === "brokerage_admin" || me.role === "team_lead") {
          const reviews = await base44.entities.FairHousingReview.filter({ reviewer_email: me.email });
          const current = {
            signed: reviews.filter((r) => r.status === "signed").length,
            overdue: reviews.filter((r) => r.status === "overdue").length,
            pending: reviews.filter((r) => r.status === "pending" || r.status === "viewed").length,
          };
          setFhStatus(current);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
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
            setUser((u) => ({ ...u, privacy_notice_accepted_at: new Date().toISOString() }));
          }}
        />
      )}

      <div className="space-y-6">
        {/* Fair housing overdue banner — only for brokerage_admin / team_lead */}
        <FairHousingBanner user={user} />

        <WelcomeHero user={user} roleLabel={ROLE_LABELS[user?.role]} />

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
          <p className="text-sm text-[#1A3226]/60 mb-6">PropPrompt™ is your AI-calibrated real estate analysis system for Eastern Massachusetts.</p>

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