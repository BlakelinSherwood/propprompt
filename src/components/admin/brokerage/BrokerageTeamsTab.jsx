import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  trial: "bg-yellow-100 text-yellow-700",
  canceled: "bg-gray-100 text-gray-500",
};

export default function BrokerageTeamsTab({ org, user }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.Organization.filter({ parent_org_id: org.id }).then((data) => {
      setTeams(data);
      setLoading(false);
    });
  }, [org.id]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const team = await base44.entities.Organization.create({
      name: newName.trim(),
      org_type: "team",
      parent_org_id: org.id,
      owner_email: user.email,
      status: "active",
    });
    setTeams((prev) => [...prev, team]);
    setNewName("");
    setCreating(false);
    toast({ title: "Team created", description: `${team.name} is ready.` });
  }

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading teams…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#1A3226]/60">{teams.length} team{teams.length !== 1 ? "s" : ""} under this brokerage</p>
        <Button size="sm" className="h-8 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="w-3.5 h-3.5" /> New Team
        </Button>
      </div>

      {creating && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1A3226]/[0.03] border border-[#1A3226]/10">
          <Input className="h-8 text-sm flex-1" placeholder="Team name…" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <Button size="sm" className="h-8 bg-[#1A3226] text-white hover:bg-[#1A3226]/90" onClick={handleCreate}>Create</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Team</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Seats</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {teams.map((t) => (
              <tr key={t.id} className="hover:bg-[#1A3226]/[0.02]">
                <td className="px-4 py-3 font-medium text-[#1A3226]">{t.name}</td>
                <td className="px-4 py-3 text-xs text-[#1A3226]/60">{t.owner_email}</td>
                <td className="px-4 py-3 text-[#1A3226]/60">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.seat_count ?? 0}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-500"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => navigate(`/team/${t.id}/admin`)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[#1A3226]/40">No teams yet. Create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}