import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function TerritoryStatsBar({ territories, states }) {
  const claimed = territories.filter(
    (t) => t.status === "active" || t.status === "reserved"
  ).length;

  const available = territories.filter((t) => t.status === "available").length;

  const multiSeat = territories.filter((t) => (t.seats_total || 1) > 1);
  const seatsRemaining = multiSeat.reduce(
    (acc, t) => acc + ((t.seats_total || 1) - (t.seats_claimed || 0)),
    0
  );

  return (
    <div className="bg-[#1A3226] text-white px-4 py-2 flex items-center justify-center gap-6 text-sm flex-wrap">
      <span>
        <span className="font-semibold text-[#B8982F]">{claimed}</span> territories claimed
      </span>
      <span className="text-[#B8982F]/40">·</span>
      <span>
        <span className="font-semibold text-[#22c55e]">{available}</span> available in ME, NH &amp; VT
      </span>
      <span className="text-[#B8982F]/40">·</span>
      <span>
        <span className="font-semibold text-[#f97316]">{seatsRemaining}</span> seats remaining in multi-seat cities
      </span>
    </div>
  );
}