import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, Loader2 } from "lucide-react";
import PaymentTrustBlock from "./PaymentTrustBlock";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

function CardForm({ clientSecret, setupIntentId, onSuccess, onBack, summary, autoApproveHours }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const cardElement = elements.getElement(CardElement);
    const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }

    onSuccess(setupIntent.payment_method, setupIntentId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A3226]">Payment Details</h2>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          Your card will not be charged until approved. Approval usually takes less than {autoApproveHours} hours.
        </p>
      </div>

      {/* Trust Block */}
       <PaymentTrustBlock />

       {/* Order Summary */}
       <div className="rounded-xl border border-[#1A3226]/10 bg-[#1A3226]/[0.02] p-5 space-y-2">
        <p className="text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wider mb-3">Order Summary</p>
        {summary.map((row, i) => (
          <div key={i} className={`flex justify-between text-sm ${row.bold ? "font-semibold text-[#1A3226]" : "text-[#1A3226]/70"} ${row.discount ? "text-emerald-600" : ""}`}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Card Element */}
      <div className="rounded-xl border border-[#1A3226]/10 p-4">
        <p className="text-xs font-medium text-[#1A3226]/50 mb-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Secured by Stripe
        </p>
        <CardElement options={{
          style: {
            base: { fontSize: "15px", color: "#1A3226", "::placeholder": { color: "#94a3b8" } },
          },
        }} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !stripe}
          className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit Claim Request
        </Button>
      </div>
    </div>
  );
}

export default function PaymentStep({ onSuccess, onBack, summary, pricing }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [setupIntentId, setSetupIntentId] = useState(null);
  const [loadError, setLoadError] = useState("");

  const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);

  useEffect(() => {
    base44.functions.invoke("createSetupIntent", {}).then(res => {
      const { clientSecret, setupIntentId } = res.data;
      setClientSecret(clientSecret);
      setSetupIntentId(setupIntentId);
    }).catch(err => setLoadError(err.message));
  }, []);

  if (loadError) return (
    <div className="text-center py-12">
      <p className="text-red-500 text-sm">{loadError}</p>
      <Button variant="outline" className="mt-4" onClick={onBack}>Back</Button>
    </div>
  );

  if (!clientSecret || !stripePromise) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" />
    </div>
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm
        clientSecret={clientSecret}
        setupIntentId={setupIntentId}
        onSuccess={onSuccess}
        onBack={onBack}
        summary={summary}
        autoApproveHours={autoApproveHours}
      />
    </Elements>
  );
}