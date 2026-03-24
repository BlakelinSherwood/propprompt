import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Search, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  trial: "bg-yellow-100 text-yellow-700",
  canceled: "bg-gray-100 text-gray-500",
};

export default function OrgsList() {
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [data, me] = await Promise.all([
          base44.asServiceRole.entities.Organization.list("-created_date", 100),
          base44.auth.me(),
        ]);

        // Ensure platform owner has a brokerage org record
        if (me?.email) {
          const ownerOrg = data.find(o => o.owner_email === me.email);
          if (!ownerOrg) {
            const created = await base44.asServiceRole.entities.Organization.create({
              name: "Sherwood & Company",
              org_type: "brokerage",
              owner_email: me.email,
              status: "active",
              subscription_plan: "brokerage",
            });
            data.unshift(created);
          }
        }

        setOrgs(data || []);
      } catch (e) {
        console.error('[OrgsList] load error:', e);
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = orgs.filter((o) =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleStatus(org) {
    const newStatus = org.status === "active" ? "suspended" : "active";
    await base44.asServiceRole.entities.Organization.update(org.id, { status: newStatus });
    setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, status: newStatus } : o)));
  }

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading organizations…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search orgs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-[#1A3226]/50">{filtered.length} organizations</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Organization</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Type</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Seats</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {filtered.map((org) => (
              <tr key={org.id} className="hover:bg-[#1A3226]/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#1A3226]/30" />
                    <span className="font-medium text-[#1A3226]">{org.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#1A3226]/60 capitalize">{org.org_type}</td>
                <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{org.owner_email}</td>
                <td className="px-4 py-3 text-[#1A3226]/60 capitalize">{org.subscription_plan || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[org.status] || "bg-gray-100 text-gray-600"}`}>{org.status}</span>
                </td>
                <td className="px-4 py-3 text-[#1A3226]/60">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{org.seat_count ?? 0}{org.seat_limit ? `/${org.seat_limit}` : ""}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleStatus(org)}>
                      {org.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => navigate(`/brokerage/${org.id}/admin`)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[#1A3226]/40">No organizations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-[#1A3226]/40 text-sm">No organizations found.</p>
        )}
        {filtered.map((org) => (
          <div key={org.id} className="rounded-xl border border-[#1A3226]/10 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-[#1A3226]/30 flex-shrink-0" />
                <span className="font-medium text-[#1A3226] truncate">{org.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[org.status] || "bg-gray-100 text-gray-600"}`}>{org.status}</span>
            </div>
            <div className="text-xs text-[#1A3226]/50 space-y-0.5">
              <p className="capitalize">{org.org_type} · {org.subscription_plan || "No plan"}</p>
              <p className="truncate">{org.owner_email}</p>
              <p className="flex items-center gap-1"><Users className="w-3 h-3" />{org.seat_count ?? 0}{org.seat_limit ? `/${org.seat_limit}` : ""} seats</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleStatus(org)}
                className="flex-1 min-h-[44px] flex items-center justify-center text-sm font-medium border border-[#1A3226]/15 rounded-lg hover:bg-[#1A3226]/5 text-[#1A3226]/70 transition-colors">
                {org.status === "active" ? "Suspend" : "Activate"}
              </button>
              <button onClick={() => navigate(`/brokerage/${org.id}/admin`)}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium bg-[#1A3226] text-white rounded-lg hover:bg-[#1A3226]/90 transition-colors">
                Manage <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}