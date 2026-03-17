import { AlertCircle, Home, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NoDataAvailableScreen({ property, onRetry, onExit }) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-6 text-center space-y-8">
      <div className="space-y-3">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto" />
        <h1 className="text-3xl font-bold text-[#1A3226]">
          Not Enough Data for a Reliable Report
        </h1>
        <p className="text-lg text-[#1A3226]/70">
          We searched public records for {property?.address || 'this property'} and didn't find enough information to generate a Client Portfolio Analysis we can stand behind.
        </p>
        <p className="text-base text-[#1A3226]/60 font-semibold">
          We'd rather tell you this now than send your client numbers we're not confident in.
        </p>
      </div>

      <div className="bg-[#FAF8F4] border border-[#1A3226]/10 rounded-lg p-6 text-left space-y-4">
        <h2 className="font-bold text-[#1A3226]">What we searched:</h2>
        <div className="space-y-2 text-sm text-[#1A3226]/70">
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0 text-[#B8982F] mt-0.5" />
            <span>Registry of Deeds for {property?.state_code || 'this state'} — No complete records found</span>
          </div>
          <div className="flex gap-2">
            <Home className="w-4 h-4 flex-shrink-0 text-[#B8982F] mt-0.5" />
            <span>Municipal assessor database — No current assessment on file</span>
          </div>
          <div className="flex gap-2">
            <FileText className="w-4 h-4 flex-shrink-0 text-[#B8982F] mt-0.5" />
            <span>Title and lien search — Insufficient data to establish clear ownership</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#B8982F]/30 rounded-lg p-6 text-left space-y-3">
        <h2 className="font-bold text-[#1A3226]">What might help:</h2>
        <ul className="space-y-2 text-sm text-[#1A3226]/70">
          <li className="flex gap-3">
            <span className="text-[#B8982F] font-bold">•</span>
            <span>Ask your client for their most recent mortgage statement (if applicable)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#B8982F] font-bold">•</span>
            <span>Request a property record from the local town or county registry</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#B8982F] font-bold">•</span>
            <span>A title company can run a full title search for approximately $150–$300</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#B8982F] font-bold">•</span>
            <span>Contact our support team if you believe public records should be available</span>
          </li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
        <p className="font-semibold">✓ No analysis credit used</p>
        <p className="text-xs mt-1">Your analysis credit has not been consumed for this attempt.</p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={onExit}
          variant="outline"
          className="flex-1"
        >
          Try Another Property
        </Button>
        <Button
          onClick={onRetry}
          className="flex-1 bg-[#1A3226]"
        >
          Provide Additional Information
        </Button>
      </div>
    </div>
  );
}