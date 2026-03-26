import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const INVITE_ROLES_BY_ROLE = {
  platform_owner: ["platform_owner", "brokerage_owner", "team_lead", "brokerage_admin", "team_admin", "individual_agent", "agent", "team_agent", "assistant"],
  brokerage_owner: ["team_lead", "brokerage_admin", "team_admin", "agent", "team_agent", "assistant"],
  brokerage_admin: ["team_lead", "team_admin", "agent", "team_agent", "assistant"],
  team_lead: ["agent", "team_agent", "assistant", "team_admin"],
};

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  brokerage_owner: "Brokerage Owner",
  team_lead: "Team Lead",
  brokerage_admin: "Brokerage Admin",
  team_admin: "Team Admin",
  agent: "Agent (under Brokerage/Team)",
  individual_agent: "Individual Agent (with Broker Permissions)",
  team_agent: "Team Agent",
  assistant: "Assistant",
};

const ROLE_GUIDE = {
  brokerage_admin: { color: "bg-[#1A3226]/10 text-[#1A3226]", desc: "Manages the brokerage account, members, and billing. Full admin access." },
  team_lead: { color: "bg-blue-50 text-blue-700", desc: "Leads a team. Can invite agents and assistants within their team." },
  agent: { color: "bg-gray-100 text-gray-700", desc: "Standard licensed agent seat. Runs analyses, accesses reports." },
  team_agent: { color: "bg-gray-100 text-gray-700", desc: "Agent working under a team lead. Same analysis access as Agent." },
  assistant: { color: "bg-purple-50 text-purple-700", desc: "Supports agents. Can run analyses on behalf of an agent. Lower seat cost." },
  team_admin: { color: "bg-blue-50 text-blue-700", desc: "Admin for a specific team. Manages team members and settings." },
  individual_agent: { color: "bg-[#B8982F]/10 text-[#B8982F]", desc: "Independent agent with broker-level permissions. No team required." },
  platform_owner: { color: "bg-[#B8982F]/10 text-[#B8982F]", desc: "Full platform access. Reserved for Sherwood & Company admins." },
  brokerage_owner: { color: "bg-[#1A3226]/10 text-[#1A3226]", desc: "Owns the brokerage license. Highest level within a brokerage." },
};

export default function InviteMemberDialog({ userRole, onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const allowedRoles = INVITE_ROLES_BY_ROLE[userRole] || [];

  async function handleInvite() {
    if (!email || !role) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("inviteMember", { email, appRole: role });
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: "Invite sent",
        description: `${email} has been invited as ${ROLE_LABELS[role] || role}.`,
      });
      onInvited();
    } catch (e) {
      toast({
        title: "Error",
        description: e.message || "Could not send invite.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-[#1A3226]/10">
          <h2 className="text-base font-semibold text-[#1A3226]">Invite Member</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#1A3226]/5 transition-colors">
            <X className="w-4 h-4 text-[#1A3226]/40" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-[#1A3226]/60 mb-1.5">Email Address</Label>
            <Input
              type="email"
              placeholder="agent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
          </div>

          <div>
            <Label className="text-xs text-[#1A3226]/60 mb-1.5">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="border-[#1A3226]/15 focus:ring-[#B8982F]/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role && ROLE_GUIDE[role] && (
              <div className={`mt-2 rounded-lg px-3 py-2 flex gap-2 items-start ${ROLE_GUIDE[role].color}`}>
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{ROLE_GUIDE[role].desc}</p>
              </div>
            )}
          </div>

          {/* Role Reference Guide */}
          <details className="group">
            <summary className="text-xs text-[#1A3226]/50 cursor-pointer hover:text-[#1A3226]/70 select-none flex items-center gap-1">
              <Info className="w-3 h-3" /> View all role descriptions
            </summary>
            <div className="mt-2 space-y-1.5 rounded-xl border border-[#1A3226]/10 p-3 bg-[#FAF8F4]">
              {allowedRoles.map(r => ROLE_GUIDE[r] ? (
                <div key={r} className="flex gap-2 items-start">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0 ${ROLE_GUIDE[r].color}`}>{ROLE_LABELS[r] || r}</span>
                  <p className="text-xs text-[#1A3226]/60 leading-relaxed">{ROLE_GUIDE[r].desc}</p>
                </div>
              ) : null)}
            </div>
          </details>

          <p className="text-xs text-[#1A3226]/40">
            An invitation email will be sent. The user will set their password upon first login.
          </p>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-[#1A3226]/10">
          <Button variant="ghost" onClick={onClose} className="text-[#1A3226]/60">
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email || sending}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
          >
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}