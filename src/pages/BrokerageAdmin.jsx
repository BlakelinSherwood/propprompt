import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import BrokerageMembersTab from "../components/admin/brokerage/BrokerageMembersTab";
import BrokerageTeamsTab from "../components/admin/brokerage/BrokerageTeamsTab";
import BrokerageAnalysesTab from "../components/admin/brokerage/BrokerageAnalysesTab";
import BrokerageAIConfigTab from "../components/admin/brokerage/BrokerageAIConfigTab";
import BrokeragePrivacyTab from "../components/admin/brokerage/BrokeragePrivacyTab";
import BrokerageBillingTab from "../components/admin/brokerage/BrokerageBillingTab";
import BrokerageFairHousingTab from "../components/admin/brokerage/BrokerageFairHousingTab";
import BrokerageBrandingTab from "../components/admin/brokerage/BrokerageBrandingTab";

export default function BrokerageAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [adminOrgs, setAdminOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);

      if (!["platform_owner", "brokerage_admin", "team_lead"].includes(me.role)) {
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
          (m) => m.org_id === id && ["brokerage_admin", "team_lead"].includes(m.role_in_org) && m.status === "active"
        );
        if (!isMember && target.owner_email !== me.email) { navigate("/Dashboard"); return; }
      }

      setOrg(target);

      // Find all orgs this user admins (for context switcher)
      const adminOrgIds = memberships
        .filter((m) => ["brokerage_admin"].includes(m.role_in_org) && m.status === "active")
        .map((m) => m.org_id);
      if (adminOrgIds.length > 1) {
        const others = await base44.entities.Organization.list();
        setAdminOrgs(others.filter((o) => adminOrgIds.includes(o.id)));
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
          <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Brokerage Admin</p>
          <h1 className="text-2xl font-semibold text-[#1A3226] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <Building2 className="w-5 h-5 text-[#1A3226]/40" />
            {org?.name}
          </h1>
          <p className="text-sm text-[#1A3226]/50 mt-1 capitalize">{org?.org_type} · {org?.status}</p>
        </div>
        {adminOrgs.length > 1 && (
          <Select value={id} onValueChange={(v) => navigate(`/brokerage/${v}/admin`)}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adminOrgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-[#1A3226]/5 border border-[#1A3226]/10 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
          <TabsTrigger value="ai">AI Config</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="billing">Usage & Billing</TabsTrigger>
          <TabsTrigger value="fairhousing">Fair Housing</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6"><BrokerageMembersTab org={org} user={user} /></TabsContent>
        <TabsContent value="teams" className="mt-6"><BrokerageTeamsTab org={org} user={user} /></TabsContent>
        <TabsContent value="analyses" className="mt-6"><BrokerageAnalysesTab org={org} user={user} /></TabsContent>
        <TabsContent value="ai" className="mt-6"><BrokerageAIConfigTab org={org} user={user} onOrgUpdate={setOrg} /></TabsContent>
        <TabsContent value="privacy" className="mt-6"><BrokeragePrivacyTab org={org} user={user} onOrgUpdate={setOrg} /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BrokerageBillingTab org={org} user={user} /></TabsContent>
        <TabsContent value="fairhousing" className="mt-6"><BrokerageFairHousingTab org={org} user={user} /></TabsContent>
        <TabsContent value="branding" className="mt-6"><BrokerageBrandingTab org={org} user={user} /></TabsContent>
      </Tabs>
    </div>
  );
}