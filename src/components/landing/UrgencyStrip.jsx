import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

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
      <div className="max-w-6xl mx-auto px-6 py-3 text-center text-xs sm:text-sm font-semibold">
        <span>{stats.claimed !== null ? stats.claimed : '—'} territories claimed</span> · <span>{stats.available !== null ? stats.available : '—'} towns available across ME, NH, VT &amp; MA</span> · Claim yours before a competitor does
      </div>
    </div>
  );
}