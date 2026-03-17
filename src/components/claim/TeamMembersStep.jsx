import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, X } from "lucide-react";

export default function TeamMembersStep({ members, onChange, onNext, onBack, ownerEmail }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");

  const addMember = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { setError("Enter a valid email"); return; }
    if (e === ownerEmail) { setError("You are already the owner"); return; }
    if (members.find(m => m.email === e)) { setError("Already added"); return; }
    onChange([...members, { email: e, role }]);
    setEmail("");
    setError("");
  };

  const remove = (em) => onChange(members.filter(m => m.email !== em));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A3226]">Team Members</h2>
        <p className="text-sm text-[#1A3226]/60 mt-1">Optionally invite team members to access this subscription. You can always add more later.</p>
      </div>

      {/* Owner badge */}
      <div className="flex items-center justify-between rounded-lg bg-[#1A3226]/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#1A3226]">{ownerEmail}</p>
          <p className="text-xs text-[#1A3226]/50">You — Owner</p>
        </div>
        <span className="text-xs bg-[#1A3226] text-white px-2 py-0.5 rounded-full">Owner</span>
      </div>

      {/* Existing members */}
      {members.map(m => (
        <div key={m.email} className="flex items-center justify-between rounded-lg border border-[#1A3226]/10 px-4 py-3">
          <div>
            <p className="text-sm text-[#1A3226]">{m.email}</p>
            <p className="text-xs text-[#1A3226]/50 capitalize">{m.role}</p>
          </div>
          <button onClick={() => remove(m.email)} className="text-[#1A3226]/30 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Add member */}
      <div className="rounded-xl border border-dashed border-[#1A3226]/20 p-4 space-y-3">
        <p className="text-xs font-medium text-[#1A3226]/60 uppercase tracking-wider">Invite a Member</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@brokerage.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMember()}
            className="flex-1"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="h-9 text-sm border border-input rounded-md px-2 bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={addMember} size="sm" variant="outline" className="gap-1.5">
            <UserPlus className="w-4 h-4" /> Add
          </Button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
          Continue →
        </Button>
      </div>
    </div>
  );
}