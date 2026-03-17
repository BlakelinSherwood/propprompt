import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap } from "lucide-react";

export default function UrgencyStrip() {
  const [stats, setStats] = useState({ claimed: null, available: null });

  const fetchStats = async () => {
    const [all, avail] = await Promise.all([
      base44.entities.Territory.list('', 10000),
      base44.entities.Territory.filter({ status: 'available' }, '', 10000),
    ]).catch(() => [[], []]);
    const claimed = all.filter(t => ['active', 'reserved', 'sublicensed'].includes(t.status)).length;
    setStats({ claimed, available: avail.length });
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
          {stats.claimed !== null ? stats.claimed : '—'} territories claimed
        </span>
        <span className="hidden sm:block text-[#1A3226]/30">·</span>
        <span>{stats.available !== null ? stats.available : '—'} towns available across ME, NH, VT &amp; MA</span>
        <span className="hidden sm:block text-[#1A3226]/30">·</span>
        <span className="uppercase tracking-wide text-[10px]">Territories are exclusive — once claimed, they're gone</span>
      </div>
    </div>
  );
}