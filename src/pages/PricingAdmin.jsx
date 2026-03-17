import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TierPricingSection from '../components/pricing/TierPricingSection';
import AnalysisCapsSection from '../components/pricing/AnalysisCapsSection';
import BundleDiscountsSection from '../components/pricing/BundleDiscountsSection';
import TopupPacksSection from '../components/pricing/TopupPacksSection';
import BuyoutDiscountsSection from '../components/pricing/BuyoutDiscountsSection';
import RevenueShareSection from '../components/pricing/RevenueShareSection';
import ThresholdsSection from '../components/pricing/ThresholdsSection';
import OveragePoolSection from '../components/pricing/OveragePoolSection';
import PricingChangeLogTable from '../components/pricing/PricingChangeLogTable';

export default function PricingAdmin() {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logKey, setLogKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user || user.role !== 'admin') { navigate('/Dashboard'); return; }
      loadPricing();
    });
  }, []);

  const loadPricing = async () => {
    const res = await base44.functions.invoke('getPricingConfig', { force_refresh: true });
    setPricing(res.data.pricing);
    setLoading(false);
  };

  const onSave = async () => {
    await loadPricing();
    setLogKey(k => k + 1); // force log refresh
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-7 h-7 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Pricing Configuration</h1>
          <p className="text-sm text-[#1A3226]/50 mt-1">
            All prices, discounts, caps, and thresholds. Changes take effect immediately for new transactions.
          </p>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Admin Only</span>
      </div>

      <TierPricingSection pricing={pricing} onSave={onSave} />
      <Divider />
      <AnalysisCapsSection pricing={pricing} onSave={onSave} />
      <Divider />
      <OveragePoolSection pricing={pricing} onSave={onSave} />
      <Divider />
      <BundleDiscountsSection pricing={pricing} onSave={onSave} />
      <Divider />
      <BuyoutDiscountsSection pricing={pricing} onSave={onSave} />
      <Divider />
      <TopupPacksSection pricing={pricing} onSave={onSave} />
      <Divider />
      <RevenueShareSection pricing={pricing} onSave={onSave} />
      <Divider />
      <ThresholdsSection pricing={pricing} onSave={onSave} />
      <Divider />
      <PricingChangeLogTable key={logKey} />
    </div>
  );
}

function Divider() {
  return <hr className="border-gray-100" />;
}