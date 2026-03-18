import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { ArrowRight, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';

export default function Claim() {
  const { user } = useAuth();
  const [step, setStep] = useState('select'); // select, apply, payment, submitted
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [formData, setFormData] = useState({
    brokerage_name: '',
    brokerage_license: '',
    agent_count: '',
  });

  useEffect(() => {
    async function loadTerritories() {
      try {
        const available = await base44.entities.Territory.filter({
          status: 'available'
        });
        setTerritories(available || []);
      } catch (err) {
        console.error('Failed to load territories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTerritories();
  }, []);

  const PLANS = [
    { id: 'starter', name: 'Starter', price: 99, analyses: 50 },
    { id: 'pro', name: 'Pro', price: 199, analyses: 150 },
    { id: 'team', name: 'Team', price: 499, analyses: 500 },
  ];

  const handleApply = async () => {
    if (!selectedTerritory || !selectedPlan || !formData.brokerage_name) {
      alert('Please complete all fields');
      return;
    }

    setApplying(true);
    try {
      // Create claim request
      await base44.entities.TerritoryClaimRequest.create({
        territory_id: selectedTerritory.id,
        user_id: user.id,
        brokerage_name: formData.brokerage_name,
        brokerage_license: formData.brokerage_license,
        agent_count: parseInt(formData.agent_count) || 0,
        tier_requested: selectedPlan,
        type_requested: 'single',
        status: 'pending',
      });

      setStep('payment');
    } catch (err) {
      console.error('Failed to create claim:', err);
      alert('Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setApplying(true);
    try {
      // Create Stripe checkout for $1 deposit
      const response = await base44.functions.invoke('createClaimCheckout', {
        amount: 100, // $1 in cents
        territory_id: selectedTerritory.id,
        plan: selectedPlan,
      });

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout:', err);
      alert('Failed to process payment');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-12">
        {['Select Territory', 'Application', 'Payment', 'Submitted'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              i < ['select', 'apply', 'payment', 'submitted'].indexOf(step) ? 'bg-[#1A3226] text-white' :
              i === ['select', 'apply', 'payment', 'submitted'].indexOf(step) ? 'bg-[#B8982F] text-[#1A3226]' :
              'bg-[#1A3226]/10 text-[#1A3226]/50'
            }`}>
              {i + 1}
            </div>
            {i < 3 && <div className="w-12 h-px bg-[#1A3226]/20 mx-2" />}
          </div>
        ))}
      </div>

      {/* Select Territory Step */}
      {step === 'select' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1A3226] mb-2">Select Your Territory</h1>
            <p className="text-[#1A3226]/60">Choose the city or region you want to claim.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {territories.map(territory => (
              <button
                key={territory.id}
                onClick={() => setSelectedTerritory(territory)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedTerritory?.id === territory.id
                    ? 'border-[#B8982F] bg-[#B8982F]/5'
                    : 'border-[#1A3226]/10 hover:border-[#B8982F]/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-[#B8982F] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#1A3226]">{territory.city_town}</p>
                    <p className="text-sm text-[#1A3226]/60">Population: {territory.population?.toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedTerritory && (
            <button
              onClick={() => setStep('apply')}
              className="w-full bg-[#1A3226] text-white font-semibold py-3 rounded-lg hover:bg-[#1A3226]/90 flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Application Step */}
      {step === 'apply' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1A3226] mb-2">Application Details</h1>
            <p className="text-[#1A3226]/60">Tell us about your brokerage and select a plan.</p>
          </div>

          <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[#1A3226]/10">
            <p className="text-sm font-semibold text-[#1A3226] mb-4">Selected Territory: <span className="text-[#B8982F]">{selectedTerritory?.city_town}</span></p>
            
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1A3226] mb-2">Brokerage Name *</label>
                <input
                  type="text"
                  value={formData.brokerage_name}
                  onChange={(e) => setFormData({...formData, brokerage_name: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
                  placeholder="Your brokerage name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A3226] mb-2">Real Estate License</label>
                <input
                  type="text"
                  value={formData.brokerage_license}
                  onChange={(e) => setFormData({...formData, brokerage_license: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
                  placeholder="License number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A3226] mb-2">Number of Agents</label>
                <input
                  type="number"
                  value={formData.agent_count}
                  onChange={(e) => setFormData({...formData, agent_count: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
                  placeholder="0"
                />
              </div>
            </form>
          </div>

          <div>
            <h3 className="font-semibold text-[#1A3226] mb-3">Select Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === plan.id
                      ? 'border-[#B8982F] bg-[#B8982F]/5'
                      : 'border-[#1A3226]/10 hover:border-[#B8982F]/30'
                  }`}
                >
                  <p className="font-semibold text-[#1A3226]">{plan.name}</p>
                  <p className="text-2xl font-bold text-[#B8982F] mt-1">${plan.price}/mo</p>
                  <p className="text-xs text-[#1A3226]/60 mt-2">{plan.analyses} analyses/month</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('select')}
              className="flex-1 border-2 border-[#1A3226] text-[#1A3226] font-semibold py-3 rounded-lg hover:bg-[#1A3226]/5"
            >
              Back
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex-1 bg-[#1A3226] text-white font-semibold py-3 rounded-lg hover:bg-[#1A3226]/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {applying ? 'Submitting...' : 'Continue to Payment'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Payment Step */}
      {step === 'payment' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1A3226] mb-2">Verify Your Card</h1>
            <p className="text-[#1A3226]/60">We'll charge $1 to confirm your card is valid. The remaining balance will be charged when your application is approved.</p>
          </div>

          <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[#1A3226]/10 space-y-4">
            <div>
              <p className="text-sm text-[#1A3226]/60">Territory</p>
              <p className="font-semibold text-[#1A3226]">{selectedTerritory?.city_town}</p>
            </div>
            <div className="border-t border-[#1A3226]/10 pt-4">
              <p className="text-sm text-[#1A3226]/60">Plan</p>
              <p className="font-semibold text-[#1A3226]">{PLANS.find(p => p.id === selectedPlan)?.name}</p>
            </div>
            <div className="border-t border-[#1A3226]/10 pt-4">
              <p className="text-sm text-[#1A3226]/60">Deposit (refundable)</p>
              <p className="text-2xl font-bold text-[#B8982F]">$1.00</p>
            </div>
          </div>

          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1A3226] mb-2">Card Number</label>
              <input
                type="text"
                placeholder="4242 4242 4242 4242"
                className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#1A3226] mb-2">Expiry</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A3226] mb-2">CVC</label>
                <input
                  type="text"
                  placeholder="123"
                  className="w-full px-4 py-2 rounded-lg border border-[#1A3226]/20 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/50"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep('apply')}
                className="flex-1 border-2 border-[#1A3226] text-[#1A3226] font-semibold py-3 rounded-lg hover:bg-[#1A3226]/5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={applying}
                className="flex-1 bg-[#1A3226] text-white font-semibold py-3 rounded-lg hover:bg-[#1A3226]/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {applying ? 'Processing...' : 'Charge $1.00'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Submitted Step */}
      {step === 'submitted' && (
        <div className="text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 text-[#B8982F] mx-auto" />
          <div>
            <h1 className="text-3xl font-bold text-[#1A3226] mb-2">Application Submitted</h1>
            <p className="text-[#1A3226]/60 max-w-md mx-auto">
              Your application for {selectedTerritory?.city_town} has been submitted. We'll review it within 48 hours and notify you of the approval status. Your $1 deposit will be refunded if not approved.
            </p>
          </div>
          <a
            href="/Landing"
            className="inline-block bg-[#1A3226] text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#1A3226]/90"
          >
            Return to Home
          </a>
        </div>
      )}
    </div>
  );
}