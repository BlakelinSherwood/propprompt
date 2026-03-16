import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Users, Activity, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLATFORM_OWNER_EMAIL = "blake.sherwood@compass.com";

export default function PlatformAdmin() {
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        setUser(me);

        if (me.role !== "platform_owner") {
          navigate("/Dashboard");
          return;
        }

        const users = await base44.entities.User.list();
        setMembers(users);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== "platform_owner") return null;

  const roleCounts = members.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});

  const statusCounts = members.reduce((acc, m) => {
    const s = m.status || "active";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-[#B8982F]" />
          <h1 className="text-xl font-semibold text-[#1A3226]">Platform Administration</h1>
        </div>
        <p className="text-sm text-[#1A3226]/50">
          Visible only to the platform owner ({PLATFORM_OWNER_EMAIL})
        </p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#1A3226]/40" />
            <span className="text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Total Users</span>
          </div>
          <p className="text-3xl font-semibold text-[#1A3226] tabular-nums">{members.length}</p>
        </div>

        <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-3xl font-semibold text-emerald-600 tabular-nums">{statusCounts.active || 0}</p>
        </div>

        <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Suspended</span>
          </div>
          <p className="text-3xl font-semibold text-amber-600 tabular-nums">{statusCounts.suspended || 0}</p>
        </div>
      </div>

      {/* Role Breakdown */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5 lg:p-6">
        <h2 className="text-sm font-semibold text-[#1A3226] mb-4">Users by Role</h2>
        <div className="space-y-3">
          {[
            { key: "platform_owner", label: "Platform Owner", color: "bg-[#B8982F]" },
            { key: "brokerage_admin", label: "Brokerage Admin", color: "bg-[#1A3226]" },
            { key: "team_lead", label: "Team Lead", color: "bg-blue-500" },
            { key: "agent", label: "Agent", color: "bg-gray-400" },
            { key: "team_agent", label: "Team Agent", color: "bg-gray-300" },
            { key: "assistant", label: "Assistant", color: "bg-purple-400" },
          ].map((r) => (
            <div key={r.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
                <span className="text-sm text-[#1A3226]/70">{r.label}</span>
              </div>
              <span className="text-sm font-medium text-[#1A3226] tabular-nums">
                {roleCounts[r.key] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hardcoded Platform Owner Info */}
      <div className="rounded-2xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5 lg:p-6">
        <h2 className="text-sm font-semibold text-[#1A3226] mb-2">Platform Owner Account</h2>
        <p className="text-xs text-[#1A3226]/60 mb-3">
          The following account is the hardcoded platform superadmin. This cannot be changed through the UI.
        </p>
        <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-[#1A3226]/10">
          <div className="w-10 h-10 rounded-full bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-sm">
            BS
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A3226]">Blake Sherwood</p>
            <p className="text-xs text-[#1A3226]/50">{PLATFORM_OWNER_EMAIL}</p>
          </div>
          <span className="ml-auto text-[10px] uppercase tracking-wider bg-[#B8982F]/20 text-[#B8982F] px-2 py-0.5 rounded-full font-medium">
            Platform Owner
          </span>
        </div>
      </div>
    </div>
  );
}