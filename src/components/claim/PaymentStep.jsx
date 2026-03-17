import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';

function CheckoutForm({ onSubmit, onBack, submitting }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');
    const { setupIntent, error: stripeErr } = await stripe.confirmSetup({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });
    if (stripeErr) { setError(stripeErr.message); setProcessing(false); return; }
    if (setupIntent?.payment_method) {
      await onSubmit(setupIntent.payment_method, setupIntent.id);
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={processing || submitting}>← Back</Button>
        <Button type="submit" disabled={!stripe || processing || submitting} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
          {(processing || submitting) ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</> : 'Submit Claim →'}
        </Button>
      </div>
    </form>
  );
}

export default function PaymentStep({ orderLines, totalMonthly, autoApproveHours, onSubmit, onBack }) {
  const [ready, setReady] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [setupIntentId, setSetupIntentId] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.functions.invoke('createClaimSetupIntent', {}).then(res => {
      setClientSecret(res.data.clientSecret);
      setSetupIntentId(res.data.setupIntentId);
      setStripePromise(loadStripe(res.data.publishableKey));
      setReady(true);
    });
  }, []);

  const handleSubmit = async (paymentMethodId, intentId) => {
    setSubmitting(true);
    await onSubmit(paymentMethodId, intentId || setupIntentId);
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1A3226]">Payment</h2>
        <p className="text-sm text-gray-500 mt-1">Your card will not be charged until your claim is approved.</p>
      </div>

      {/* Order Summary */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[#1A3226]">Order Summary</h3>
        {orderLines.map((line, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{line.label}</span>
            <span className="font-medium text-[#1A3226]">{line.value}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-3 flex justify-between">
          <span className="font-semibold text-[#1A3226]">Monthly Total</span>
          <span className="font-bold text-[#1A3226] text-lg">${parseFloat(totalMonthly).toFixed(2)}/mo</span>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
        <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Your card is saved but <strong>not charged</strong> until your claim is approved. Approval typically takes less than <strong>{autoApproveHours || 48} hours</strong>.
        </p>
      </div>

      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payment form…
        </div>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <CheckoutForm onSubmit={handleSubmit} onBack={onBack} submitting={submitting} />
        </Elements>
      )}
    </div>
  );
}