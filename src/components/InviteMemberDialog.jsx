import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Info, Users, UserPlus, Gift } from "lucide-react";
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
  const [tab, setTab] = useState("team");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [personalNote, setPersonalNote] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const allowedRoles = INVITE_ROLES_BY_ROLE[userRole] || [];

  async function handleTeamInvite() {
    if (!email || !role) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("inviteMember", { email, appRole: role });
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: "Invite sent",
        description: `${email} invited as ${ROLE_LABELS[role] || role}. They'll get 20% off their first 2 months.`,
      });
      onInvited();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not send invite.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function handleExternalInvite() {
    if (!email) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendReferralInvite", { email, personalNote: personalNote || null });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.already_sent) {
        toast({ title: "Already invited", description: `An invite is already pending for ${email}.` });
      } else {
        toast({
          title: "Referral invite sent!",
          description: `${email} will receive 20% off their first 2 months. You'll get 10% off your next month when they sign up.`,
        });
      }
      onInvited();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not send invite.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1A3226]/10">
          <h2 className="text-base font-semibold text-[#1A3226]">Invite</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#1A3226]/5 transition-colors">
            <X className="w-4 h-4 text-[#1A3226]/40" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1A3226]/10">
          <button
            onClick={() => setTab("team")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === "team" ? "text-[#1A3226] border-b-2 border-[#1A3226]" : "text-[#1A3226]/40 hover:text-[#1A3226]/60"}`}
          >
            <Users className="w-4 h-4" /> Team Member
          </button>
          <button
            onClick={() => setTab("external")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === "external" ? "text-[#1A3226] border-b-2 border-[#1A3226]" : "text-[#1A3226]/40 hover:text-[#1A3226]/60"}`}
          >
            <UserPlus className="w-4 h-4" /> External Referral
          </button>
        </div>

        {/* Discount Banner */}
        <div className="mx-5 mt-4 flex items-center gap-3 bg-[#B8982F]/8 border border-[#B8982F]/25 rounded-xl px-4 py-3">
          <Gift className="w-4 h-4 text-[#B8982F] flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[#1A3226]">
              {tab === "team" ? "Invitee gets 20% off their first 2 months" : "They get 20% off · You get 10% off your next month"}
            </p>
            <p className="text-[10px] text-[#1A3226]/50 mt-0.5">Must sign up within 30 days of the invite.</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-[#1A3226]/60 mb-1.5">Email Address</Label>
            <Input
              type="email"
              placeholder={tab === "team" ? "agent@example.com" : "colleague@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
          </div>

          {tab === "team" && (
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
          )}

          {tab === "external" && (
            <div>
              <Label className="text-xs text-[#1A3226]/60 mb-1.5">Personal Note <span className="text-[#1A3226]/30">(optional)</span></Label>
              <textarea
                placeholder="Add a personal message to your invite..."
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                rows={3}
                className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#B8982F]/30 resize-none"
              />
              <p className="text-xs text-[#1A3226]/40 mt-1.5">
                They'll receive a branded invite email with their discount link. No org membership is created — they sign up independently.
              </p>
            </div>
          )}

          {tab === "team" && (
            <p className="text-xs text-[#1A3226]/40">
              An invitation email will be sent. The user will set their password upon first login.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-[#1A3226]/10">
          <Button variant="ghost" onClick={onClose} className="text-[#1A3226]/60">Cancel</Button>
          <Button
            onClick={tab === "team" ? handleTeamInvite : handleExternalInvite}
            disabled={!email || sending}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
          >
            {sending ? "Sending..." : tab === "team" ? "Send Team Invite" : "Send Referral Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}