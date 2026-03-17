import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';

export default function TeamMembersStep({ members, onChange, onNext, onBack, ownerEmail }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');

  const addMember = () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return; }
    if (email === ownerEmail) { setError('You are already the owner'); return; }
    if (members.find(m => m.email === email)) { setError('Already added'); return; }
    onChange([...members, { email, role }]);
    setEmail(''); setError('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1A3226]">Team Members</h2>
        <p className="text-sm text-gray-500 mt-1">Optionally add team members who can use this territory. You'll be the owner.</p>
      </div>

      {/* Owner badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1A3226]/5 border border-[#1A3226]/10">
        <div className="w-8 h-8 rounded-full bg-[#1A3226] text-white text-xs flex items-center justify-center font-bold">
          {ownerEmail?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#1A3226]">{ownerEmail}</p>
          <p className="text-xs text-gray-400">Owner</p>
        </div>
      </div>

      {/* Members list */}
      {members.map((m, i) => (
        <div key={m.email} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
          <div className="flex-1">
            <p className="text-sm text-[#1A3226]">{m.email}</p>
            <p className="text-xs text-gray-400 capitalize">{m.role}</p>
          </div>
          <button onClick={() => onChange(members.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Add member */}
      <div className="flex gap-2">
        <Input
          placeholder="colleague@brokerage.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && addMember()}
          className="flex-1"
        />
        <select value={role} onChange={e => setRole(e.target.value)} className="border border-gray-200 rounded-md px-3 text-sm">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button variant="outline" size="sm" onClick={addMember}><Plus className="w-4 h-4" /></Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
      </div>
    </div>
  );
}