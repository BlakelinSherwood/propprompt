import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportStateIndicator({ state, confidenceScore, blockingConditions, warningConditions, onAcknowledge }) {
  if (state === 'green') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex gap-3 items-start">
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-green-900">✓ Data Quality: High Confidence</p>
          <p className="text-sm text-green-800 mt-1">
            Public records found and verified. This report is based on official registry data.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'yellow') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-yellow-900">⚠ Data Quality: Partial — Review Before Sending</p>
            <p className="text-sm text-yellow-800 mt-1 mb-3">
              This report was generated with incomplete public records. The following sections are based on estimates or assumptions:
            </p>
            <ul className="text-sm text-yellow-800 space-y-1">
              {warningConditions.map((condition, idx) => (
                <li key={idx}>• {condition}</li>
              ))}
            </ul>
            <p className="text-sm text-yellow-800 mt-3 font-semibold">
              Do not present this report as definitive. Review all flagged sections with your client and recommend they verify key figures with their lender or an attorney.
            </p>
          </div>
        </div>
        {onAcknowledge && (
          <div className="rounded-lg border border-yellow-200 bg-white p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                onChange={(e) => onAcknowledge(e.target.checked)}
              />
              <span className="text-sm text-[#1A3226]">
                I understand this report contains estimated figures and I will present it as such to my client. I will not use this as a definitive financial document.
              </span>
            </label>
          </div>
        )}
      </div>
    );
  }

  if (state === 'red') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 flex gap-4 items-start">
        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-red-900 text-lg">🚫 Cannot Generate Report</p>
          <p className="text-sm text-red-800 mt-2">
            PropPrompt cannot produce a reliable Client Portfolio Analysis for this property because:
          </p>
          <ul className="text-sm text-red-800 mt-3 space-y-1 mb-4">
            {blockingConditions.map((condition, idx) => (
              <li key={idx}>• {condition}</li>
            ))}
          </ul>
          <p className="text-sm text-red-800 mb-4">
            A report with this data quality could be misleading. We'd rather tell you now than have inaccurate information reach your client.
          </p>
          <div className="bg-red-100 rounded p-3 text-sm text-red-900">
            <p className="font-semibold mb-2">What you can do:</p>
            <ul className="space-y-1">
              <li>• Ask your client for recent mortgage or payoff statements</li>
              <li>• Check with a title company for a full title search</li>
              <li>• Request property records from the local registry</li>
              <li>• Contact support if you believe this is a data error</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
}