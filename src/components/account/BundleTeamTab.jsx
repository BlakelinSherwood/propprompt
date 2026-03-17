import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Trash2, Loader2 } from "lucide-react";

export default function BundleTeamTab({ bundle, teamMembers, currentUser, onRefresh }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [inviteError, setInviteError] = useState('');
  const [saving, setSaving] = useState(null);

  const invite = async () => {
    if (!email.includes('@')) { setInviteError('Enter a valid email'); return; }
    if (teamMembers.find(m => m.user_id === email)) { setInviteError('Already a member'); return; }
    setSaving('invite');
    setInviteError('');
    await base44.entities.BundleUserMember.create({
      bundle_id: bundle.id,
      user_id: email,
      role,
      invited_by: currentUser?.id,
      invited_at: new Date().toISOString(),
      status: 'pending',
    });
    setEmail('');
    setSaving(null);
    onRefresh();
  };

  const remove = async (memberId) => {
    setSaving(memberId);
    await base44.entities.BundleUserMember.delete(memberId);
    setSaving(null);
    onRefresh();
  };

  const changeRole = async (member, newRole) => {
    setSaving(member.id + '_role');
    await base44.entities.BundleUserMember.update(member.id, { role: newRole });
    setSaving(null);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Invite */}
      <div className="rounded-xl border border-dashed border-[#1A3226]/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wider">Invite Member</p>
        <div className="flex gap-2">
          <Input
            type="email" placeholder="colleague@brokerage.com"
            value={email} onChange={e => { setEmail(e.target.value); setInviteError(''); }}
            onKeyDown={e => e.key === 'Enter' && invite()}
            className="flex-1"
          />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="h-9 text-sm border border-input rounded-md px-2 bg-transparent focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={invite} disabled={saving === 'invite'} size="sm" variant="outline" className="gap-1.5 h-9">
            {saving === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
          </Button>
        </div>
        {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
      </div>

      {/* Members list */}
      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/8">
              {['Email', 'Role', 'Analyses This Month', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((m, i) => {
              const isOwner = m.role === 'owner';
              const isMe = m.user_id === currentUser?.email;
              return (
                <tr key={m.id} className={`border-b border-[#1A3226]/5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#1A3226]/[0.01]'}`}>
                  <td className="px-4 py-3 text-[#1A3226] font-medium">
                    {m.user_id} {isMe && <span className="text-xs text-[#1A3226]/40">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <span className="text-xs bg-[#1A3226] text-white px-2 py-0.5 rounded-full">Owner</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={e => changeRole(m, e.target.value)}
                        disabled={saving === m.id + '_role'}
                        className="text-xs border border-input rounded px-2 py-1 bg-transparent focus:outline-none">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{m.analyses_this_month || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {!isOwner && !isMe && (
                      <button onClick={() => remove(m.id)} disabled={saving === m.id}
                        className="text-[#1A3226]/30 hover:text-red-500 transition-colors">
                        {saving === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}