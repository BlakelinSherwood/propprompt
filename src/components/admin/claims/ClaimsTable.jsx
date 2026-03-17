import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClaimDetail from "./ClaimDetail";
import moment from "moment";

const TYPE_LABELS = { single: 'Single', pool: 'Pool', bundle: 'Bundle', buyout: 'Buyout' };
const TYPE_COLORS = {
  single: 'bg-emerald-100 text-emerald-700',
  pool: 'bg-blue-100 text-blue-700',
  bundle: 'bg-purple-100 text-purple-700',
  buyout: 'bg-amber-100 text-amber-700',
};
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

function getClaimType(c) {
  if (c.pool_id) return 'pool';
  if (c.bundle_id) return 'bundle';
  if (c.type_requested === 'county_bundle' || c.type_requested === 'full_buyout') return 'buyout';
  return 'single';
}

function getTerritorySummary(claim, stateMap) {
  const type = getClaimType(claim);
  if (type === 'single') return claim._territory ? `${claim._territory}, ${claim._state}` : claim.territory_id || '—';
  if (type === 'pool') return claim._poolSummary || 'Population Pool';
  if (type === 'bundle') return claim._bundleSummary || 'Town Bundle';
  if (type === 'buyout') return claim._buyoutSummary || 'Full Buyout';
  return '—';
}

function Countdown({ autoApproveAt }) {
  if (!autoApproveAt) return <span className="text-[#1A3226]/30">—</span>;
  const diff = new Date(autoApproveAt) - new Date();
  if (diff <= 0) return <span className="text-red-500 text-xs font-medium">Overdue</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const color = h < 4 ? 'text-orange-600' : h < 24 ? 'text-amber-600' : 'text-[#1A3226]/50';
  return <span className={`text-xs font-medium ${color}`}>{h}h {m}m</span>;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'pool', label: 'Pool' },
  { key: 'bundle', label: 'Bundle' },
  { key: 'buyout', label: 'Buyout' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ClaimsTable({ claims, pricing, onApprove, onReject }) {
  const [tab, setTab] = useState('pending');
  const [expanded, setExpanded] = useState(null);

  const filtered = claims.filter(c => {
    if (tab === 'all') return true;
    if (tab === 'pending') return c.status === 'pending';
    if (tab === 'approved') return c.status === 'approved';
    if (tab === 'rejected') return c.status === 'rejected';
    return getClaimType(c) === tab && c.status === 'pending';
  });

  const toggleRow = (id) => setExpanded(e => e === id ? null : id);

  return (
    <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 border-b border-[#1A3226]/10 overflow-x-auto pb-0">
        {TABS.map(t => {
          const count = t.key === 'all' ? claims.length
            : t.key === 'pending' ? claims.filter(c => c.status === 'pending').length
            : t.key === 'approved' ? claims.filter(c => c.status === 'approved').length
            : t.key === 'rejected' ? claims.filter(c => c.status === 'rejected').length
            : claims.filter(c => getClaimType(c) === t.key && c.status === 'pending').length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                tab === t.key ? 'bg-[#1A3226] text-white' : 'text-[#1A3226]/60 hover:text-[#1A3226] hover:bg-[#1A3226]/5'
              }`}>
              {t.label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 ${tab === t.key ? 'bg-white/20 text-white' : 'bg-[#1A3226]/10 text-[#1A3226]/60'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/8">
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Submitted</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Brokerage</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Territory / Summary</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Tier</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Value</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Auto-approves</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/50 text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-[#1A3226]/30 text-sm">No claims in this view.</td></tr>
            )}
            {filtered.map((c, i) => {
              const type = getClaimType(c);
              const isExpanded = expanded === c.id;
              return [
                <tr key={c.id}
                  onClick={() => toggleRow(c.id)}
                  className={`border-b border-[#1A3226]/5 cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#1A3226]/[0.01]'} hover:bg-[#1A3226]/[0.04] ${isExpanded ? 'bg-[#1A3226]/[0.03]' : ''}`}>
                  <td className="px-4 py-3 text-[#1A3226]/60 whitespace-nowrap">
                    {moment(c.created_date).fromNow()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[type]}`}>
                      {TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1A3226]">{c.brokerage_name || '—'}</td>
                  <td className="px-4 py-3 text-[#1A3226]/70 max-w-[240px]">
                    <div className="truncate">{getTerritorySummary(c)}</div>
                    {c._releasedRecord && (
                      <div className="flex items-center gap-1 mt-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 w-fit whitespace-nowrap">
                        ⚠️ Right of first refusal — expires {new Date(c._releasedRecord.right_of_refusal_expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-[#1A3226]/70">{c.tier_requested}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1A3226]">
                    {c._monthlyValue ? `$${c._monthlyValue}/mo` : '—'}
                  </td>
                  <td className="px-4 py-3"><Countdown autoApproveAt={c.auto_approve_at} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {c.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => onApprove(c)}
                          className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onReject(c)}
                          className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1">
                          <XCircle className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                    {c.status === 'approved' && <span className="text-xs text-emerald-600">✓ Approved</span>}
                    {c.status === 'rejected' && <span className="text-xs text-red-500">✗ Rejected</span>}
                  </td>
                  <td className="px-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#1A3226]/40" /> : <ChevronDown className="w-4 h-4 text-[#1A3226]/20" />}
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`${c.id}-detail`} className="bg-[#1A3226]/[0.015]">
                    <td colSpan={10} className="p-0">
                      <ClaimDetail claim={c} pricing={pricing} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}