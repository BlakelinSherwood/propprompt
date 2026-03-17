import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PropertyRecordSummary({ record, clientName, onRefresh, loading }) {
  if (!record || record.search_status === 'error') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <p className="font-semibold">Unable to retrieve property records</p>
        <p className="text-xs mt-1">{record?.search_notes}</p>
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="mt-3 gap-2"
          disabled={loading}
        >
          <RefreshCw className="w-3 h-3" /> Try Again
        </Button>
      </div>
    );
  }

  const ownerMismatch = clientName && record.owner_of_record && 
    record.owner_of_record.toLowerCase() !== clientName.toLowerCase();

  const formatCurrency = (val) => val ? `$${Math.round(val).toLocaleString()}` : '—';
  const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '—';

  return (
    <div className="space-y-4">
      {ownerMismatch && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold">Ownership mismatch</p>
            <p className="text-xs mt-1">
              Owner of record shows <span className="font-semibold">{record.owner_of_record}</span>.
              Client name provided was <span className="font-semibold">{clientName}</span>.
              Please verify ownership before sending this report.
            </p>
          </div>
        </div>
      )}

      <div className="border border-[#1A3226]/10 rounded-lg p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#1A3226]/60">Owner of Record</span>
          <div className="font-semibold text-[#1A3226] flex items-center gap-2">
            {record.owner_of_record || '—'}
            {record.owner_verified && <span className="text-green-600">✓</span>}
            {ownerMismatch && <span className="text-yellow-600">⚠</span>}
          </div>
        </div>

        <div className="border-t border-[#1A3226]/10" />

        <div className="flex justify-between text-sm">
          <span className="text-[#1A3226]/60">Last Sale</span>
          <div className="font-semibold text-[#1A3226]">
            {formatDate(record.last_sale_date)} for {formatCurrency(record.last_sale_price)}
          </div>
        </div>

        {record.deed_book_page && (
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/60">Deed Reference</span>
            <span className="text-[#1A3226] font-mono text-xs">{record.deed_book_page}</span>
          </div>
        )}

        <div className="border-t border-[#1A3226]/10" />

        {record.original_mortgage_amount && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Recorded Mortgage</span>
              <div className="font-semibold text-[#1A3226] text-right">
                <div>{formatCurrency(record.original_mortgage_amount)}</div>
                <div className="text-xs text-[#1A3226]/60 font-normal">
                  {record.original_mortgage_lender} — {formatDate(record.original_mortgage_date)}
                </div>
              </div>
            </div>

            {record.most_recent_mortgage_date && (
              <div className="flex justify-between text-sm">
                <span className="text-[#1A3226]/60">Refinanced</span>
                <div className="font-semibold text-[#1A3226] text-right">
                  <div>{formatCurrency(record.most_recent_mortgage_amount)}</div>
                  <div className="text-xs text-[#1A3226]/60 font-normal">
                    {record.most_recent_mortgage_lender} — {formatDate(record.most_recent_mortgage_date)}
                  </div>
                </div>
              </div>
            )}

            {record.mortgage_discharged && (
              <div className="flex justify-between text-sm">
                <span className="text-[#1A3226]/60">Mortgage Status</span>
                <span className="font-semibold text-green-600">Discharged</span>
              </div>
            )}

            <div className="border-t border-[#1A3226]/10" />
          </>
        )}

        {record.assessed_value && (
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/60">Assessed Value</span>
            <div className="font-semibold text-[#1A3226]">
              {formatCurrency(record.assessed_value)}
              <span className="text-xs text-[#1A3226]/60 font-normal ml-1">({record.assessed_year})</span>
            </div>
          </div>
        )}

        {record.annual_property_tax && (
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/60">Annual Property Tax</span>
            <span className="font-semibold text-[#1A3226]">{formatCurrency(record.annual_property_tax)}</span>
          </div>
        )}

        {record.liens_found && (
          <>
            <div className="border-t border-[#1A3226]/10" />
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Liens/Encumbrances</span>
              <span className="font-semibold text-yellow-600 text-right text-xs">
                {record.lien_details || 'Found'}
              </span>
            </div>
          </>
        )}

        <div className="border-t border-[#1A3226]/10" />

        <div className="flex justify-between items-center text-xs">
          <span className="text-[#1A3226]/60">
            Source: Searched {formatDate(record.searched_at)}
          </span>
          <Button
            onClick={onRefresh}
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={loading}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {record.search_notes && (
        <div className="text-xs text-[#1A3226]/60 italic p-3 bg-[#1A3226]/5 rounded">
          {record.search_notes}
        </div>
      )}
    </div>
  );
}