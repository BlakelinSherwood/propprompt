import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

const ROLE_LABELS = { team_lead: "Team Lead", agent: "Agent", team_agent: "Team Agent", assistant: "Assistant" };
const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  pending_invite: "bg-yellow-100 text-yellow-700",
};

export default function TeamMembersTab({ org, user }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.OrgMembership.filter({ org_id: org.id }).then((d) => { setMembers(d); setLoading(false); });
  }, [org.id]);

  const filtered = members.filter((m) => m.user_email?.toLowerCase().includes(search.toLowerCase()));

  async function handleInvite() {
    setInviting(true);
    const m = await base44.entities.OrgMembership.create({
      user_email: inviteEmail, org_id: org.id, role_in_org: inviteRole,
      status: "pending_invite", invited_by_email: user.email,
      invite_sent_at: new Date().toISOString(),
      invite_expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
    setMembers((prev) => [...prev, m]);
    setInviteEmail(""); setInviting(false);
    toast({ title: "Invite sent", description: `${inviteEmail} invited as ${ROLE_LABELS[inviteRole]}.` });
  }

  async function toggleStatus(member) {
    const s = member.status === "active" ? "suspended" : "active";
    await base44.entities.OrgMembership.update(member.id, { status: s });
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, status: s } : m));
  }

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading members…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 rounded-xl bg-[#1A3226]/[0.03] border border-[#1A3226]/10">
        <Input className="h-9 text-sm flex-1" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        <select className="h-9 rounded-md border border-input px-3 text-sm bg-white" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Button size="sm" className="h-9 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-1.5 shrink-0" onClick={handleInvite} disabled={!inviteEmail || inviting}>
          <UserPlus className="w-4 h-4" /> Invite
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
        <Input className="pl-9 h-9 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Email</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Role</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-[#1A3226]/[0.02]">
                <td className="px-4 py-3 text-[#1A3226]">{m.user_email}</td>
                <td className="px-4 py-3 text-xs text-[#1A3226]/60">{ROLE_LABELS[m.role_in_org] || m.role_in_org}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] || "bg-gray-100 text-gray-600"}`}>
                    {m.status?.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleStatus(m)}>{m.status === "active" ? "Suspend" : "Activate"}</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => base44.entities.OrgMembership.delete(m.id).then(() => setMembers((prev) => prev.filter((x) => x.id !== m.id)))}>
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-[#1A3226]/40">No members found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}