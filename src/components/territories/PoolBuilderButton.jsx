import { useState } from "react";
import { Layers, X, Plus, Minus, ArrowRight } from "lucide-react";

export default function PoolBuilderButton({ territories, pricing, stateMap }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  const bucketSize = pricing.pool_bucket_size || 50000;
  const starterPrice = pricing.starter_monthly_price || 149;

  const totalPop = selected.reduce((acc, t) => acc + (t.population || 0), 0);
  const buckets = Math.ceil(totalPop / bucketSize);
  const estimatedPrice = buckets * starterPrice;

  const available = territories.filter(
    (t) =>
      (t.status === "available" || t.status === "coming_soon") &&
      !selected.find((s) => s.id === t.id)
  );

  const results = search
    ? available.filter((t) =>
        t.city_town?.toLowerCase().includes(search.toLowerCase())
      )
    : available.slice(0, 8);

  const add = (t) => setSelected((s) => [...s, t]);
  const remove = (id) => setSelected((s) => s.filter((t) => t.id !== id));

  const ids = selected.map((t) => t.id).join(",");
  const claimUrl = `/claim?type=pool&territories=${ids}`;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-[#1A3226] text-white px-4 py-2.5 rounded-xl shadow-lg hover:bg-[#1A3226]/90 transition-colors text-sm font-semibold"
      >
        <Layers className="w-4 h-4" />
        Build a Population Pool
      </button>

      {/* Drawer */}
      {open && (
        <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/30">
          <div className="bg-white w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A3226]/8">
              <div>
                <h3 className="font-semibold text-[#1A3226]">Build a Population Pool</h3>
                <p className="text-xs text-[#1A3226]/50 mt-0.5">Select towns to combine into a shared territory</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-[#1A3226]/5 rounded-lg text-[#1A3226]/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search towns to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-[#1A3226]/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
              />

              {/* Search results */}
              {results.length > 0 && (
                <div className="border border-[#1A3226]/10 rounded-xl overflow-hidden">
                  {results.map((t) => {
                    const st = stateMap[t.state_id];
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-[#1A3226]/3 border-b border-[#1A3226]/5 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm text-[#1A3226] font-medium">{t.city_town}</p>
                          <p className="text-[10px] text-[#1A3226]/40">{st?.code} · {(t.population || 0).toLocaleString()} pop</p>
                        </div>
                        <button
                          onClick={() => add(t)}
                          className="p-1.5 bg-[#1A3226] text-white rounded-lg hover:bg-[#1A3226]/90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected towns */}
              {selected.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wider mb-2">Selected Towns</p>
                  <div className="space-y-1.5">
                    {selected.map((t) => {
                      const st = stateMap[t.state_id];
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between bg-[#1A3226]/5 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-sm text-[#1A3226] font-medium">{t.city_town}, {st?.code}</p>
                            <p className="text-[10px] text-[#1A3226]/40">{(t.population || 0).toLocaleString()} pop</p>
                          </div>
                          <button
                            onClick={() => remove(t.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live meter */}
              {selected.length > 0 && (
                <div className="bg-[#1A3226]/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1A3226]/60">Total Population</span>
                    <span className="font-semibold text-[#1A3226]">{totalPop.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1A3226]/60">Buckets ({bucketSize.toLocaleString()} pop each)</span>
                    <span className="font-semibold text-[#1A3226]">{buckets}</span>
                  </div>
                  {/* Population bar */}
                  <div className="h-2 bg-[#1A3226]/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1A3226] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (totalPop / (bucketSize * 10)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-[#1A3226]/10">
                    <span className="text-[#1A3226]/60">Estimated Monthly</span>
                    <span className="font-bold text-[#1A3226]">${estimatedPrice.toLocaleString()}/mo</span>
                  </div>
                  <p className="text-[10px] text-[#1A3226]/40">${starterPrice}/mo per bucket of {bucketSize.toLocaleString()} residents</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-[#1A3226]/8">
              <a
                href={selected.length > 0 ? claimUrl : undefined}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  selected.length > 0
                    ? "bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
                    : "bg-[#1A3226]/20 text-[#1A3226]/40 cursor-not-allowed"
                }`}
              >
                Continue to Claim
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}