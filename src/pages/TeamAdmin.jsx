import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import TeamMembersTab from "../components/admin/team/TeamMembersTab";
import TeamAnalysesTab from "../components/admin/team/TeamAnalysesTab";
import TeamAIConfigTab from "../components/admin/team/TeamAIConfigTab";
import TeamPrivacyTab from "../components/admin/team/TeamPrivacyTab";
import TeamUsageTab from "../components/admin/team/TeamUsageTab";

export default function TeamAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [parentOrg, setParentOrg] = useState(null);
  const [leadTeams, setLeadTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);

      if (!["platform_owner", "team_lead", "brokerage_admin"].includes(me.role)) {
        navigate("/Dashboard");
        return;
      }

      const [orgData, memberships] = await Promise.all([
        base44.entities.Organization.filter({ id }),
        base44.entities.OrgMembership.filter({ user_email: me.email }),
      ]);

      const target = orgData[0];
      if (!target) { navigate("/Dashboard"); return; }

      // Access check
      if (me.role !== "platform_owner") {
        const isMember = memberships.some(
          (m) => m.org_id === id && ["team_lead", "brokerage_admin"].includes(m.role_in_org) && m.status === "active"
        );
        if (!isMember && target.owner_email !== me.email) { navigate("/Dashboard"); return; }
      }

      setOrg(target);

      // Load parent brokerage for AI config context
      if (target.parent_org_id) {
        const parents = await base44.entities.Organization.filter({ id: target.parent_org_id });
        setParentOrg(parents[0] || null);
      }

      // Find all teams this user leads (for context switcher)
      const leadOrgIds = memberships
        .filter((m) => m.role_in_org === "team_lead" && m.status === "active")
        .map((m) => m.org_id);
      if (leadOrgIds.length > 1) {
        const allOrgs = await base44.entities.Organization.list();
        setLeadTeams(allOrgs.filter((o) => leadOrgIds.includes(o.id)));
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Team Lead Admin</p>
          <h1 className="text-2xl font-semibold text-[#1A3226] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <Users className="w-5 h-5 text-[#1A3226]/40" />
            {org?.name}
          </h1>
          {parentOrg && (
            <p className="text-sm text-[#1A3226]/50 mt-1">Under {parentOrg.name}</p>
          )}
        </div>
        {leadTeams.length > 1 && (
          <Select value={id} onValueChange={(v) => navigate(`/team/${v}/admin`)}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-[#1A3226]/5 border border-[#1A3226]/10 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
          <TabsTrigger value="ai">AI Config</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6"><TeamMembersTab org={org} user={user} /></TabsContent>
        <TabsContent value="analyses" className="mt-6"><TeamAnalysesTab org={org} user={user} /></TabsContent>
        <TabsContent value="ai" className="mt-6"><TeamAIConfigTab org={org} parentOrg={parentOrg} user={user} onOrgUpdate={setOrg} /></TabsContent>
        <TabsContent value="privacy" className="mt-6"><TeamPrivacyTab org={org} parentOrg={parentOrg} user={user} onOrgUpdate={setOrg} /></TabsContent>
        <TabsContent value="usage" className="mt-6"><TeamUsageTab org={org} user={user} /></TabsContent>
      </Tabs>
    </div>
  );
}