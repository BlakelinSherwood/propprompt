import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UserPlus, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InviteMemberDialog from "../components/InviteMemberDialog";
import MemberRow from "../components/MemberRow";

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  brokerage_admin: "Brokerage Admin",
  team_lead: "Team Lead",
  agent: "Agent",
  assistant: "Assistant",
  team_agent: "Team Agent",
};

export default function Members() {
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const users = await base44.entities.User.list();
      setMembers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = members.filter(
    (m) =>
      (m.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const canInvite =
    user?.role === "platform_owner" ||
    user?.role === "brokerage_admin" ||
    user?.role === "team_lead";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1A3226]">Team Members</h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
        {canInvite && (
          <Button
            onClick={() => setShowInvite(true)}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 border-[#1A3226]/15 bg-white focus-visible:ring-[#B8982F]/30"
        />
      </div>

      {/* Members List */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1" />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#1A3226]/40">
            No members found.
          </div>
        ) : (
          filtered.map((member) => (
            <MemberRow key={member.id} member={member} roleLabels={ROLE_LABELS} />
          ))
        )}
      </div>

      {showInvite && (
        <InviteMemberDialog
          userRole={user?.role}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}