import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePricing } from '@/components/pricing/usePricing';

const TYPE_LABELS = {
  single: 'Single Territory',
  pool: 'Population Pool',
  bundle: 'Town Bundle',
  buyout: 'Full City Buyout',
};

export default function ClaimSubmitted() {
  const { state } = useLocation();
  const { pricing } = usePricing();
  const { claimType, territories = [], tier, monthlyPrice, buckets, bundleName, discount, seats, stateName } = state || {};

  const autoApproveHours = pricing.auto_approve_hours || 48;

  if (!claimType) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <p className="text-gray-500 mb-4">No claim data found.</p>
        <Link to="/claim"><Button>Start a Claim</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-6">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Claim Submitted!</h1>
          <p className="text-gray-500 mt-2">Your territory claim is under review.</p>
        </div>

        {/* Claim details */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Claim Type</span>
            <span className="font-medium text-[#1A3226]">{TYPE_LABELS[claimType]}</span>
          </div>
          {territories.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{territories.length === 1 ? 'Territory' : 'Territories'}</span>
              <span className="font-medium text-[#1A3226] text-right">
                {territories.length === 1
                  ? territories[0].city_town
                  : `${territories.length} territories`}
              </span>
            </div>
          )}
          {claimType === 'pool' && buckets && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Buckets</span>
              <span className="font-medium text-[#1A3226]">{buckets}</span>
            </div>
          )}
          {claimType === 'bundle' && bundleName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bundle</span>
              <span className="font-medium text-[#1A3226]">{bundleName} ({discount}% off)</span>
            </div>
          )}
          {claimType === 'buyout' && seats && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Seats</span>
              <span className="font-medium text-[#1A3226]">{seats} (Full Buyout)</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tier</span>
            <span className="font-medium text-[#1A3226] capitalize">{tier}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
            <span className="text-gray-500">Monthly Price</span>
            <span className="font-bold text-[#1A3226] text-base">${parseFloat(monthlyPrice || 0).toFixed(2)}/mo</span>
          </div>
        </div>

        {/* Review timeline */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-left">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            We'll review your claim within <strong>{autoApproveHours} hours</strong>. 
            Your card will only be charged upon approval. We'll email you when a decision is made.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/territories" className="flex-1">
            <Button variant="outline" className="w-full gap-2"><MapPin className="w-4 h-4" /> Back to Map</Button>
          </Link>
          <Link to="/Dashboard" className="flex-1">
            <Button className="w-full bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}