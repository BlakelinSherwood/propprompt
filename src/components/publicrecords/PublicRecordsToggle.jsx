import { Toggle } from '@/components/ui/toggle';
import { MapPin, Loader2 } from 'lucide-react';

export default function PublicRecordsToggle({ enabled, onChange, loading }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-[#1A3226]/10 rounded-lg bg-[#FAF8F4]">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#1A3226]">Pull Public Records</p>
        <p className="text-xs text-[#1A3226]/60">
          {enabled
            ? 'Including assessed value, sales history, and mortgage data'
            : 'Add property records to supplement your analysis'}
        </p>
      </div>
      <Toggle
        pressed={enabled}
        onPressedChange={onChange}
        disabled={loading}
        className={`${enabled ? 'bg-[#B8982F] text-white' : ''}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
      </Toggle>
    </div>
  );
}