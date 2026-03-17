import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PayoffInputCard({ publicRecord, onSubmit }) {
  const [method, setMethod] = useState(publicRecord?.original_mortgage_amount ? 'estimated' : null);
  const [actualPayoff, setActualPayoff] = useState('');
  const [goodThroughDate, setGoodThroughDate] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [loanDate, setLoanDate] = useState('');
  const [term, setTerm] = useState('30');

  const handleEstimate = () => {
    let low, high, basis, confidence;

    if (publicRecord?.original_mortgage_amount) {
      const principal = publicRecord.original_mortgage_amount;
      const months = parseInt(term) * 12;
      const rate = 0.065; // 6.5% assumed current rate
      
      const monthlyPayment = (principal * rate / 12) / (1 - Math.pow(1 + rate / 12, -months));
      const monthsElapsed = publicRecord.original_mortgage_date 
        ? Math.round((new Date() - new Date(publicRecord.original_mortgage_date)) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      
      const remainingBalance = principal * Math.pow(1 + rate / 12, -monthsElapsed) / 
                               Math.pow(1 + rate / 12, -months);
      
      low = Math.max(0, remainingBalance * 0.9);
      high = remainingBalance * 1.1;
      confidence = publicRecord.mortgage_discharged ? 'high' : 
                   publicRecord.most_recent_mortgage_date ? 'high' : 'medium';
      basis = `Based on ${principal.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} 
               recorded ${new Date(publicRecord.original_mortgage_date).toLocaleDateString()}, 
               assuming ${term}-year amortization at 6.5%`;
    } else {
      // Manual input estimate
      const principal = parseFloat(originalAmount);
      const months = parseInt(term) * 12;
      const rate = 0.065;
      const monthsElapsed = (new Date() - new Date(loanDate)) / (1000 * 60 * 60 * 24 * 30);
      
      const remainingBalance = principal * Math.pow(1 + rate / 12, -monthsElapsed) / 
                               Math.pow(1 + rate / 12, -months);
      
      low = Math.max(0, remainingBalance * 0.85);
      high = remainingBalance * 1.15;
      confidence = 'low';
      basis = `Estimated based on ${principal.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} 
               original loan from ${new Date(loanDate).toLocaleDateString()}`;
    }

    onSubmit({
      payoff_method: 'estimated',
      estimated_payoff_low: Math.round(low),
      estimated_payoff_high: Math.round(high),
      estimation_basis: basis,
      estimation_confidence: confidence
    });
  };

  const handleActual = () => {
    onSubmit({
      payoff_method: 'actual',
      actual_payoff_amount: parseFloat(actualPayoff),
      payoff_good_through_date: goodThroughDate || null
    });
  };

  const mortgageFound = publicRecord?.original_mortgage_amount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#1A3226] mb-2">Mortgage Payoff</h3>
        {mortgageFound ? (
          <div className="p-4 bg-[#B8982F]/5 border border-[#B8982F]/20 rounded-lg text-sm text-[#1A3226]/70">
            <p className="mb-2">
              We found a mortgage of{' '}
              <span className="font-semibold">
                ${publicRecord.original_mortgage_amount.toLocaleString()}
              </span>{' '}
              recorded {new Date(publicRecord.original_mortgage_date).toLocaleDateString()} with{' '}
              <span className="font-semibold">{publicRecord.original_mortgage_lender}</span>.
            </p>
            {publicRecord.most_recent_mortgage_date && (
              <p className="mb-2">
                A refinance was recorded {new Date(publicRecord.most_recent_mortgage_date).toLocaleDateString()} for{' '}
                <span className="font-semibold">
                  ${publicRecord.most_recent_mortgage_amount.toLocaleString()}
                </span>.
              </p>
            )}
            {publicRecord.mortgage_discharged && (
              <p className="text-yellow-700 font-semibold">
                ⚠️ A mortgage discharge was recorded — this property may be owned free and clear. Confirm with client.
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            We were unable to locate mortgage records for this property. You can still provide a payoff amount manually.
          </div>
        )}
      </div>

      <RadioGroup value={method} onValueChange={setMethod}>
        {/* Estimate Card */}
        <div
          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
            method === 'estimated'
              ? 'border-[#B8982F] bg-[#B8982F]/5'
              : 'border-gray-200 bg-white'
          }`}
          onClick={() => setMethod('estimated')}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="estimated" className="mt-1" />
            <div className="flex-1">
              <p className="font-semibold text-[#1A3226]">Estimate Payoff</p>
              <p className="text-sm text-[#1A3226]/60">
                We'll calculate an estimated range based on public records
              </p>

              {method === 'estimated' && (
                <div className="mt-4 space-y-4 pt-4 border-t border-[#B8982F]/10">
                  {mortgageFound ? (
                    <>
                      <div className="bg-white p-3 rounded border border-[#B8982F]/20">
                        <p className="text-sm text-[#1A3226]/70 mb-2">Estimated remaining balance:</p>
                        <p className="text-lg font-bold text-[#B8982F]">
                          $XXX,XXX — $XXX,XXX
                        </p>
                        <p className="text-xs text-[#1A3226]/50 mt-2">
                          Assumes standard 30-year amortization at estimated prevailing rate
                        </p>
                        <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          High Confidence
                        </div>
                      </div>
                      <Button onClick={handleEstimate} className="w-full bg-[#B8982F]">
                        Use This Estimate
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-semibold text-[#1A3226]">
                          Original loan amount
                        </label>
                        <Input
                          type="number"
                          placeholder="$250,000"
                          value={originalAmount}
                          onChange={(e) => setOriginalAmount(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-[#1A3226]">
                          Loan date
                        </label>
                        <Input
                          type="date"
                          value={loanDate}
                          onChange={(e) => setLoanDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-[#1A3226]">
                          Loan term
                        </label>
                        <select
                          value={term}
                          onChange={(e) => setTerm(e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-input rounded-md text-sm"
                        >
                          <option value="15">15 years</option>
                          <option value="20">20 years</option>
                          <option value="30">30 years</option>
                        </select>
                      </div>
                      <Button onClick={handleEstimate} className="w-full bg-[#B8982F]">
                        Calculate Estimate
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actual Payoff Card */}
        <div
          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
            method === 'actual'
              ? 'border-[#1A3226] bg-[#1A3226]/5'
              : 'border-gray-200 bg-white'
          }`}
          onClick={() => setMethod('actual')}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="actual" className="mt-1" />
            <div className="flex-1">
              <p className="font-semibold text-[#1A3226]">I have the exact payoff</p>
              <p className="text-sm text-[#1A3226]/60">
                Enter the figure from the client's payoff statement
              </p>

              {method === 'actual' && (
                <div className="mt-4 space-y-4 pt-4 border-t border-[#1A3226]/10">
                  <div>
                    <label className="text-sm font-semibold text-[#1A3226]">
                      Exact payoff amount ($)
                    </label>
                    <Input
                      type="number"
                      placeholder="$235,450"
                      value={actualPayoff}
                      onChange={(e) => setActualPayoff(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#1A3226]">
                      Good through date (optional)
                    </label>
                    <Input
                      type="date"
                      value={goodThroughDate}
                      onChange={(e) => setGoodThroughDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <p className="text-xs text-[#1A3226]/60">
                    Using exact payoff improves the accuracy of all scenario calculations.
                  </p>
                  <Button onClick={handleActual} className="w-full bg-[#1A3226]">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Use Verified Payoff
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}