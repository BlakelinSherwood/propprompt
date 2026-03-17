import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ClaimTypeSelector from '../components/claim/ClaimTypeSelector';
import SingleFlow from '../components/claim/SingleFlow';
import PoolFlow from '../components/claim/PoolFlow';
import BundleFlow from '../components/claim/BundleFlow';
import BuyoutFlow from '../components/claim/BuyoutFlow';

const TYPE_LABELS = {
  single: 'Single Territory',
  pool: 'Population Pool',
  bundle: 'Town Bundle',
  buyout: 'Full City Buyout',
};

export default function Claim() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialType = urlParams.get('type');
  const territoryId = urlParams.get('territory_id');

  const [claimType, setClaimType] = useState(initialType || null);

  useEffect(() => {
    if (initialType) setClaimType(initialType);
  }, [initialType]);

  return (
    <div className="max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        {claimType ? (
          <button onClick={() => setClaimType(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1A3226]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <Link to="/territories" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1A3226]">
            <ArrowLeft className="w-4 h-4" /> Territory Map
          </Link>
        )}
        {claimType && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-gray-300">/</span>
            <span className="font-medium text-[#1A3226]">{TYPE_LABELS[claimType]}</span>
          </div>
        )}
      </div>

      {!claimType && <ClaimTypeSelector onSelect={setClaimType} />}
      {claimType === 'single' && <SingleFlow territoryId={territoryId} />}
      {claimType === 'pool' && <PoolFlow territoryId={territoryId} />}
      {claimType === 'bundle' && <BundleFlow territoryId={territoryId} />}
      {claimType === 'buyout' && <BuyoutFlow territoryId={territoryId} />}
    </div>
  );
}