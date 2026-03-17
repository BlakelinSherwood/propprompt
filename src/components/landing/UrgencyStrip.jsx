import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap } from "lucide-react";

export default function UrgencyStrip() {
  const [stats, setStats] = useState({ claimedThisWeek: null, available: null });

  const fetchStats = async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [recent, avail] = await Promise.all([
      base44.entities.TerritorySubscription.filter({ created_date: { $gte: weekAgo } }),
      base44.entities.Territory.filter({ status: 'available' }),
    ]).catch(() => [[], []]);
    setStats({ claimedThisWeek: recent.length, available: avail.length });
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#B8982F] text-[#1A3226]">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          {stats.claimedThisWeek !== null ? stats.claimedThisWeek : '—'} territories claimed this week
        </span>
        <span className="hidden sm:block text-[#1A3226]/30">·</span>
        <span>{stats.available !== null ? stats.available : '—'} towns still available in ME, NH &amp; VT</span>
        <span className="hidden sm:block text-[#1A3226]/30">·</span>
        <span className="uppercase tracking-wide text-[10px]">Territories are exclusive — once claimed, they're gone</span>
      </div>
    </div>
  );
}