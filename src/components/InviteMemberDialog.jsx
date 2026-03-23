import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
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
          </div>

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