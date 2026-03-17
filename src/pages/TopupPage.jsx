import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

let cachedStripePromise = null;
let cachedStripeKey = null;
function getStripePromise(publishableKey) {
  if (cachedStripeKey !== publishableKey) {
    cachedStripePromise = loadStripe(publishableKey);
    cachedStripeKey = publishableKey;
  }
  return cachedStripePromise;
}
import { Loader2, ShoppingCart, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

function CheckoutForm({ pack, clientSecret, paymentIntentId, subscriptionId, bundleId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const card = elements.getElement(CardElement);
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      // Confirm and create the topup pack record
      const res = await base44.functions.invoke('confirmTopup', {
        payment_intent_id: paymentIntentId,
        pack_key: pack.key,
        subscription_id: subscriptionId,
        bundle_id: bundleId,
      });
      if (res.data?.success) {
        onSuccess(res.data);
      } else {
        setError(res.data?.error || 'Failed to activate pack');
      }
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5">
        <p className="text-xs font-semibold text-[#B8982F] uppercase tracking-wider mb-1">You're purchasing</p>
        <p className="text-2xl font-bold text-[#1A3226]">{pack.analyses} Analyses</p>
        <p className="text-sm text-[#1A3226]/60">One-time · ${pack.price} · ${(pack.price / pack.analyses).toFixed(2)}/each</p>
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 p-4">
        <p className="text-xs font-medium text-[#1A3226]/50 mb-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Secured by Stripe
        </p>
        <CardElement options={{ style: { base: { fontSize: '15px', color: '#1A3226', '::placeholder': { color: '#94a3b8' } } } }} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!stripe || loading} className="flex-1 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Pay ${pack.price}
        </Button>
      </div>
    </div>
  );
}

export default function TopupPage() {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedKey = urlParams.get('pack');

  const [selectedPack, setSelectedPack] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);

  const packs = pricing ? [
    { key: 'starter', analyses: parseInt(pricing.topup_starter_analyses || 10), price: parseFloat(pricing.topup_starter_price || 29) },
    { key: 'standard', analyses: parseInt(pricing.topup_standard_analyses || 25), price: parseFloat(pricing.topup_standard_price || 59) },
    { key: 'pro', analyses: parseInt(pricing.topup_pro_analyses || 50), price: parseFloat(pricing.topup_pro_price || 99) },
    { key: 'bulk', analyses: parseInt(pricing.topup_bulk_analyses || 100), price: parseFloat(pricing.topup_bulk_price || 179) },
  ] : [];

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      return Promise.all([
        base44.entities.TerritorySubscription.filter({ user_id: me.id, status: 'active' }),
        base44.entities.TerritoryBundle.filter({ owner_user_id: me.id, status: 'active' }),
      ]);
    }).then(([singles, bundles]) => {
      setSubscriptions([...singles.map(s => ({ id: s.id, label: `Single — ${s.tier}`, type: 'single' })), ...bundles.map(b => ({ id: b.id, label: `Bundle — ${b.bundle_name}`, type: 'bundle' }))]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!pricingLoading && preselectedKey && packs.length > 0) {
      const p = packs.find(x => x.key === preselectedKey);
      if (p) setSelectedPack(p);
    }
  }, [pricingLoading, preselectedKey]);

  const handleBuy = async (pack) => {
    if (window !== window.top) {
      alert('Top-up purchases are only available from the published app, not in preview mode.');
      return;
    }
    setLoadingCheckout(true);
    const sub = subscriptions[0];
    const res = await base44.functions.invoke('purchaseTopup', {
      pack_key: pack.key,
      subscription_id: sub?.type === 'single' ? sub.id : undefined,
      bundle_id: sub?.type === 'bundle' ? sub.id : undefined,
    });
    const { clientSecret, paymentIntentId, publishableKey } = res.data;
    setStripePromise(getStripePromise(publishableKey));
    setCheckoutData({ clientSecret, paymentIntentId, pack });
    setSelectedPack(pack);
    setLoadingCheckout(false);
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle className="w-9 h-9 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Top-up Active!</h1>
          <p className="text-[#1A3226]/60 mt-2">{success.analyses} analyses added. Expires in {parseInt(pricing?.topup_expiry_days || 90)} days.</p>
        </div>
        <Button onClick={() => navigate('/Dashboard')} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3226]">Purchase Analysis Top-Up</h1>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          One-time packs · Expire {parseInt(pricing?.topup_expiry_days || 90)} days after purchase · No subscription required
        </p>
      </div>

      {!checkoutData ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packs.map(pack => {
            const perAnalysis = (pack.price / pack.analyses).toFixed(2);
            return (
              <div key={pack.key} className="rounded-2xl border-2 border-[#1A3226]/10 bg-white p-6 hover:border-[#B8982F]/50 hover:shadow-md transition-all">
                <p className="text-3xl font-bold text-[#1A3226]">{pack.analyses}</p>
                <p className="text-sm text-[#1A3226]/50 mb-4">analyses</p>
                <p className="text-2xl font-bold text-[#1A3226]">${pack.price}</p>
                <p className="text-xs text-[#1A3226]/40 mb-5">${perAnalysis} per analysis</p>
                <Button
                  onClick={() => handleBuy(pack)}
                  disabled={loadingCheckout || pricingLoading}
                  className="w-full bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
                >
                  {loadingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  Buy Now
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-[#1A3226]/10 p-7">
            {stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret: checkoutData.clientSecret }}>
                <CheckoutForm
                  pack={checkoutData.pack}
                  clientSecret={checkoutData.clientSecret}
                  paymentIntentId={checkoutData.paymentIntentId}
                  subscriptionId={subscriptions.find(s => s.type === 'single')?.id}
                  bundleId={subscriptions.find(s => s.type === 'bundle')?.id}
                  onSuccess={(data) => setSuccess(data)}
                  onCancel={() => setCheckoutData(null)}
                />
              </Elements>
            )}
          </div>
        </div>
      )}
    </div>
  );
}