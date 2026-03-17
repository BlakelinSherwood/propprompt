import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function PublicRecordsDisclosure({ onAccepted }) {
  const [agreed, setAgreed] = useState(false);

  // Check session storage to avoid re-prompting
  useEffect(() => {
    const sessionAccepted = sessionStorage.getItem('public_records_disclosure_accepted');
    if (sessionAccepted) {
      onAccepted();
    }
  }, [onAccepted]);

  const handleAccept = () => {
    sessionStorage.setItem('public_records_disclosure_accepted', 'true');
    onAccepted();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-[#B8982F] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-[#1A3226]">Public Records Disclosure</h3>
            <p className="text-xs text-[#1A3226]/60 mt-1">
              Please review before using public property records
            </p>
          </div>
        </div>

        <div className="bg-[#FAF8F4] p-4 rounded-lg text-sm text-[#1A3226]/80 space-y-3 max-h-48 overflow-y-auto">
          <p>
            <span className="font-semibold">Property record information</span> is sourced from public
            registries of deed and municipal assessor records. Data accuracy depends on recording
            timeliness and municipal data availability.
          </p>
          <p>
            <span className="font-semibold">Mortgage payoff estimates</span> are approximations based
            on public recording data and historical rate assumptions. They are{' '}
            <span className="font-semibold">NOT official payoff statements</span>. Clients should obtain
            an official payoff statement from their lender before making any financial decisions.
          </p>
          <p>
            <span className="font-semibold">This report is prepared for licensed real estate
            professional use only</span> and should not be distributed to unlicensed individuals or
            used in violation of state real estate regulations.
          </p>
        </div>

        <div className="flex items-start gap-3 p-3 border border-[#1A3226]/10 rounded-lg">
          <Checkbox
            checked={agreed}
            onCheckedChange={setAgreed}
            id="disclosure-agree"
            className="mt-0.5"
          />
          <label htmlFor="disclosure-agree" className="text-sm text-[#1A3226] cursor-pointer">
            I acknowledge this disclosure and understand the limitations of public records data in
            real estate transactions.
          </label>
        </div>

        <Button
          onClick={handleAccept}
          disabled={!agreed}
          className="w-full bg-[#1A3226] text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}