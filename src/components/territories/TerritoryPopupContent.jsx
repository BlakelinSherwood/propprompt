import { useNavigate } from "react-router-dom";

function getBuyoutDiscount(pricing, seats) {
  if (seats >= 10) return pricing.buyout_10plus_seat_discount || 30;
  if (seats >= 5) return pricing.buyout_5_9seat_discount || 28;
  if (seats >= 3) return pricing.buyout_3_4seat_discount || 25;
  return pricing.buyout_2seat_discount || 20;
}

export default function TerritoryPopupContent({ territory: t, state, county, pricing }) {
  const stateName = state?.code || "";
  const countyName = county?.name?.replace(" County", "") || "";
  const seats = t.seats_total || 1;
  const claimed = t.seats_claimed || 0;
  const available = seats - claimed;
  const isFullyBoughtOut = t.status === "active" && claimed >= seats;
  const isPartial = t.status === "active" && claimed < seats;

  const starterPrice = pricing.starter_monthly_price || 149;
  const proPrice = pricing.pro_monthly_price || 249;

  const discount = getBuyoutDiscount(pricing, seats);
  const buyoutPrice = Math.round(proPrice * seats * (1 - discount / 100));

  const nav = (path) => { window.location.href = path; };

  const btn = (label, href, primary = true) => (
    <a
      href={href}
      className={`block w-full text-center text-xs font-semibold py-1.5 rounded-lg mt-1.5 transition-colors ${
        primary
          ? "bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
          : "border border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
      }`}
    >
      {label}
    </a>
  );

  const header = (
    <div className="mb-2">
      <p className="font-semibold text-[#1A3226] text-sm leading-tight">
        {t.city_town}, {stateName}
      </p>
      {countyName && (
        <p className="text-[10px] text-[#1A3226]/50">{countyName} County</p>
      )}
    </div>
  );

  // Coming soon
  if (t.status === "coming_soon") {
    return (
      <div className="p-3 w-64">
        {header}
        <p className="text-xs text-[#1A3226]/60 mb-2">PropPrompt is coming to this state soon.</p>
        {btn("Join Waitlist", `/waitlist?territory_id=${t.id}`)}
      </div>
    );
  }

  // Reserved
  if (t.status === "reserved") {
    return (
      <div className="p-3 w-64">
        {header}
        <span className="inline-block text-[10px] bg-[#1e293b] text-white px-2 py-0.5 rounded-full mb-2">Founding Partner Territory</span>
        <p className="text-xs text-[#1A3226]/60">This territory is reserved.</p>
      </div>
    );
  }

  // Pool member
  if (t.status === "pool_member") {
    return (
      <div className="p-3 w-64">
        {header}
        <span className="inline-block text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full mb-2">Part of a Population Pool</span>
        <p className="text-xs text-[#1A3226]/60 mb-2">This town is claimed as part of a territory pool.</p>
        {btn("Join Waitlist", `/waitlist?territory_id=${t.id}`, false)}
      </div>
    );
  }

  // Fully bought out
  if (isFullyBoughtOut) {
    return (
      <div className="p-3 w-64">
        {header}
        <span className="inline-block text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full mb-2">Exclusively Claimed — Full Buyout</span>
        <p className="text-xs text-[#1A3226]/60 mb-2">This city is fully reserved by one PropPrompt partner.</p>
        {btn("Join Waitlist", `/waitlist?territory_id=${t.id}`, false)}
      </div>
    );
  }

  // Partial
  if (isPartial) {
    return (
      <div className="p-3 w-64">
        {header}
        <p className="text-xs text-[#1A3226]/70 mb-2">
          <span className="font-semibold text-[#f97316]">{available}</span> of {seats} seats available
        </p>
        {btn("Claim a Seat →", `/claim?type=single&territory_id=${t.id}`)}
      </div>
    );
  }

  // Available single-seat
  if (t.status === "available" && seats === 1) {
    return (
      <div className="p-3 w-64">
        {header}
        <div className="text-xs text-[#1A3226]/60 space-y-0.5 mb-2 border-b border-[#1A3226]/8 pb-2">
          <p>Population: <span className="font-medium text-[#1A3226]">{(t.population || 0).toLocaleString()}</span></p>
          <p>Status: <span className="font-medium text-[#22c55e]">Available</span></p>
        </div>
        <p className="text-[10px] text-[#1A3226]/50 uppercase tracking-wider mb-1 font-medium">Claim Options</p>
        <p className="text-xs text-[#1A3226]/70">• Single territory from <strong>${starterPrice}/mo</strong></p>
        <p className="text-xs text-[#1A3226]/70 mb-2">• Add to a Population Pool</p>
        {btn("Claim This Territory →", `/claim?type=single&territory_id=${t.id}`)}
        {btn("Add to Pool", `/claim?type=pool&add=${t.id}`, false)}
      </div>
    );
  }

  // Available multi-seat
  if (t.status === "available" && seats > 1) {
    return (
      <div className="p-3 w-64">
        {header}
        <div className="text-xs text-[#1A3226]/60 space-y-0.5 mb-2 border-b border-[#1A3226]/8 pb-2">
          <p>Population: <span className="font-medium text-[#1A3226]">{(t.population || 0).toLocaleString()}</span></p>
          <p>Seats Available: <span className="font-medium text-[#22c55e]">{available} of {seats}</span></p>
        </div>
        <p className="text-[10px] text-[#1A3226]/50 uppercase tracking-wider mb-1 font-medium">Claim Options</p>
        <p className="text-xs text-[#1A3226]/70">• Single seat from <strong>${proPrice}/mo</strong></p>
        <p className="text-xs text-[#1A3226]/70 mb-0.5">• Buy all {seats} seats — Full Exclusivity</p>
        <p className="text-xs text-[#22c55e] font-semibold mb-2">${buyoutPrice}/mo (save {discount}%)</p>
        {btn("Claim a Seat →", `/claim?type=single&territory_id=${t.id}`)}
        {btn(`Buy All ${seats} Seats`, `/claim?type=buyout&territory_id=${t.id}`, false)}
      </div>
    );
  }

  // Pending
  if (t.status === "pending_approval") {
    return (
      <div className="p-3 w-64">
        {header}
        <span className="inline-block text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending Approval</span>
      </div>
    );
  }

  return (
    <div className="p-3 w-64">{header}</div>
  );
}