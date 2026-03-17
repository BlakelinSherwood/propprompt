import { Clock, CheckCircle, XCircle, Layers, Grid3X3, Shield, AlertTriangle } from "lucide-react";

function StatCard({ icon: Icon, label, value, color = "text-[#1A3226]", bg = "bg-white" }) {
  return (
    <div className={`${bg} rounded-xl border border-[#1A3226]/10 p-4 flex items-start gap-3`}>
      <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#1A3226]">{value}</p>
        <p className="text-xs text-[#1A3226]/50 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function ClaimsStatsRow({ claims }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const pending = claims.filter(c => c.status === 'pending');
  const getType = c => c.pool_id ? 'pool' : c.bundle_id ? 'bundle' : (c.type_requested === 'county_bundle' || c.type_requested === 'full_buyout') ? 'buyout' : 'single';

  const stats = {
    pending: pending.length,
    pool: pending.filter(c => getType(c) === 'pool').length,
    bundle: pending.filter(c => getType(c) === 'bundle').length,
    buyout: pending.filter(c => getType(c) === 'buyout').length,
    autoSoon: pending.filter(c => c.auto_approve_at && c.auto_approve_at <= in24h).length,
    approvedToday: claims.filter(c => c.status === 'approved' && c.approved_at?.startsWith(today)).length,
    rejectedToday: claims.filter(c => c.status === 'rejected' && c.rejected_at?.startsWith(today)).length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      <StatCard icon={Clock} label="Pending" value={stats.pending} />
      <StatCard icon={Layers} label="Pool Claims" value={stats.pool} color="text-blue-600" />
      <StatCard icon={Grid3X3} label="Bundle Claims" value={stats.bundle} color="text-purple-600" />
      <StatCard icon={Shield} label="Buyout Claims" value={stats.buyout} color="text-amber-600" />
      <StatCard icon={AlertTriangle} label="Auto-approves <24h" value={stats.autoSoon} color="text-orange-500" bg={stats.autoSoon > 0 ? "bg-orange-50" : "bg-white"} />
      <StatCard icon={CheckCircle} label="Approved Today" value={stats.approvedToday} color="text-emerald-600" />
      <StatCard icon={XCircle} label="Rejected Today" value={stats.rejectedToday} color="text-red-500" />
    </div>
  );
}