import { ChevronDown, ArrowUpDown } from "lucide-react";

function getBuyoutDiscount(pricing, seats) {
  if (seats >= 10) return pricing.buyout_10plus_seat_discount || 30;
  if (seats >= 5) return pricing.buyout_5_9seat_discount || 28;
  if (seats >= 3) return pricing.buyout_3_4seat_discount || 25;
  return pricing.buyout_2seat_discount || 20;
}

const STATUS_BADGE = {
  available: "bg-green-50 text-green-700",
  pending_approval: "bg-yellow-50 text-yellow-700",
  active: "bg-orange-50 text-orange-700",
  reserved: "bg-slate-100 text-slate-700",
  coming_soon: "bg-slate-50 text-slate-400",
  pool_member: "bg-indigo-50 text-indigo-700",
};

function statusLabel(t) {
  if (t.status === "active") {
    if ((t.seats_claimed || 0) >= (t.seats_total || 1)) return "Fully Claimed";
    return "Partial";
  }
  return t.status?.replace("_", " ") || "";
}

export default function TerritorySidebar({
  territories,
  stateMap,
  countyMap,
  pricing,
  sort,
  onSortChange,
  onSelectTerritory,
  selectedTerritory,
}) {
  const proPrice = pricing.pro_monthly_price || 249;

  const sorted = [...territories].sort((a, b) => {
    if (sort === "alpha") return (a.city_town || "").localeCompare(b.city_town || "");
    if (sort === "pop") return (b.population || 0) - (a.population || 0);
    if (sort === "seats") {
      const aAvail = (a.seats_total || 1) - (a.seats_claimed || 0);
      const bAvail = (b.seats_total || 1) - (b.seats_claimed || 0);
      return bAvail - aAvail;
    }
    return 0;
  });

  return (
    <div className="hidden md:flex flex-col w-80 bg-white border-l border-[#1A3226]/10 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#1A3226]/8 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#1A3226]">{territories.length} territories</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-xs border border-[#1A3226]/15 rounded-lg px-2 py-1 focus:outline-none"
        >
          <option value="alpha">A–Z</option>
          <option value="pop">Population ↓</option>
          <option value="seats">Seats Available ↓</option>
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((t) => {
          const st = stateMap[t.state_id];
          const seats = t.seats_total || 1;
          const claimed = t.seats_claimed || 0;
          const available = seats - claimed;
          const isMulti = seats > 1;
          const discount = getBuyoutDiscount(pricing, seats);
          const buyoutPrice = Math.round(proPrice * seats * (1 - discount / 100));
          const isSelected = selectedTerritory?.id === t.id;
          const badge = STATUS_BADGE[t.status] || "bg-gray-50 text-gray-500";

          return (
            <div
              key={t.id}
              onClick={() => onSelectTerritory(t)}
              className={`px-3 py-2.5 border-b border-[#1A3226]/5 cursor-pointer hover:bg-[#1A3226]/3 transition-colors ${
                isSelected ? "bg-[#1A3226]/5 border-l-2 border-l-[#1A3226]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A3226] truncate">{t.city_town}</p>
                  <p className="text-[10px] text-[#1A3226]/40">{st?.code} · {(t.population || 0).toLocaleString()} pop</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 capitalize ${badge}`}>
                  {statusLabel(t)}
                </span>
              </div>

              {isMulti && (
                <p className="text-xs text-[#1A3226]/60 mt-0.5">
                  {available} of {seats} seats available
                </p>
              )}

              {t.status === "available" && (
                <div className="flex gap-1.5 mt-1.5">
                  <a
                    href={`/claim?type=single&territory_id=${t.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-center text-[10px] font-semibold bg-[#1A3226] text-white py-1 rounded-lg hover:bg-[#1A3226]/90 transition-colors"
                  >
                    Claim
                  </a>
                  {isMulti && available === seats && (
                    <a
                      href={`/claim?type=buyout&territory_id=${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center text-[10px] font-semibold border border-[#1A3226]/20 text-[#1A3226] py-1 rounded-lg hover:bg-[#1A3226]/5 transition-colors"
                    >
                      Buyout ${buyoutPrice}/mo
                    </a>
                  )}
                </div>
              )}
              {t.status === "active" && available > 0 && (
                <a
                  href={`/claim?type=single&territory_id=${t.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block mt-1.5 w-full text-center text-[10px] font-semibold bg-[#f97316] text-white py-1 rounded-lg hover:bg-[#f97316]/90 transition-colors"
                >
                  Claim a Seat
                </a>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-[#1A3226]/40">
            No territories match your filters.
          </div>
        )}
      </div>
    </div>
  );
}