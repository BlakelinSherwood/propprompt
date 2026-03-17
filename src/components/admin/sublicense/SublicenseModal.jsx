import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Search, User } from "lucide-react";

const TIERS = ["starter", "pro", "team"];

export default function SublicenseModal({ town, open, onClose, onCreated, pricing }) {
  const { toast } = useToast();
  const min = pricing?.sublicense_min_share_pct ?? 10;
  const max = pricing?.sublicense_max_share_pct ?? 40;
  const defaultPct = pricing?.sublicense_default_share_pct ?? 20;

  const [email, setEmail] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tier, setTier] = useState("starter");
  const [pct, setPct] = useState(defaultPct);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const tierPrice = pricing?.[`${tier}_monthly_price`] || 49;
  const yourCut = ((tierPrice * pct) / 100).toFixed(2);

  useEffect(() => {
    if (!open) {
      setEmail(""); setUserSearch(""); setFoundUsers([]);
      setSelectedUser(null); setTier("starter"); setPct(defaultPct); setNote("");
    }
  }, [open, defaultPct]);

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    setSearching(true);
    try {
      const all = await base44.entities.User.list();
      const q = userSearch.toLowerCase();
      setFoundUsers(all.filter(u =>
        u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)
      ).slice(0, 5));
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  const submit = async () => {
    const targetEmail = selectedUser?.email || email;
    if (!targetEmail || !town) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('createSublicense', {
        territory_id: town.id,
        sublicensee_email: targetEmail,
        sublicensee_user_id: selectedUser?.id || null,
        tier,
        revenue_share_pct: pct,
        note,
      });
      if (res.data?.success) {
        toast({ title: "Sublicense created", description: `${town.city_town} sublicensed to ${targetEmail}` });
        onCreated?.();
        onClose();
      } else {
        toast({ title: "Error", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  if (!town) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sublicense — {town.city_town}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* User search */}
          <div>
            <label className="text-sm font-medium text-[#1A3226] mb-1 block">Sublicensee</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUsers()}
              />
              <Button variant="outline" size="sm" onClick={searchUsers} disabled={searching}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {foundUsers.length > 0 && (
              <div className="mt-1 border rounded-lg overflow-hidden">
                {foundUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setEmail(u.email); setFoundUsers([]); setUserSearch(u.full_name || u.email); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1A3226]/5 text-left text-sm"
                  >
                    <User className="w-3.5 h-3.5 text-[#1A3226]/40" />
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-[#1A3226]/50">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-[#1A3226]/40 mt-1">Or enter a new email directly:</p>
            <Input
              placeholder="sublicensee@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setSelectedUser(null); }}
              className="mt-1"
            />
          </div>

          {/* Tier */}
          <div>
            <label className="text-sm font-medium text-[#1A3226] mb-2 block">Subscription Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    tier === t ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-[#1A3226]/10 text-[#1A3226]/70 hover:border-[#1A3226]/20'
                  }`}
                >
                  <p className="text-xs font-semibold capitalize">{t}</p>
                  <p className="text-sm font-bold mt-0.5">${pricing?.[`${t}_monthly_price`] || '—'}/mo</p>
                </button>
              ))}
            </div>
          </div>

          {/* Revenue share slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-[#1A3226]">Your Revenue Share</label>
              <span className="text-lg font-bold text-purple-600">{pct}%</span>
            </div>
            <Slider min={min} max={max} step={1} value={[pct]} onValueChange={([v]) => setPct(v)} />
            <div className="flex justify-between text-xs text-[#1A3226]/40 mt-1">
              <span>{min}%</span><span>{max}%</span>
            </div>
            <div className="mt-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
              You receive <strong>${yourCut}/mo</strong> · Sublicensee pays <strong>${tierPrice}/mo</strong>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-[#1A3226] mb-1 block">Internal Note (optional)</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Internal notes about this arrangement…" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={loading || (!email && !selectedUser)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? "Creating…" : "Create Sublicense"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}