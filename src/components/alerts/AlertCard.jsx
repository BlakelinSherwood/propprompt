import { Flame, TrendingDown, Zap, X, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALERT_ICONS = {
  market_heat: Flame,
  market_cooling: TrendingDown,
  opportunity: Zap,
};

const ALERT_COLORS = {
  market_heat: "bg-red-50 border-red-200",
  market_cooling: "bg-blue-50 border-blue-200",
  opportunity: "bg-green-50 border-green-200",
};

const ALERT_BADGES = {
  market_heat: "bg-red-100 text-red-700",
  market_cooling: "bg-blue-100 text-blue-700",
  opportunity: "bg-green-100 text-green-700",
};

export default function AlertCard({ alert, territory, onDismiss, onAction }) {
  const Icon = ALERT_ICONS[alert.alert_type] || Zap;
  const createdAt = new Date(alert.created_at);
  const hoursAgo = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60));
  const timeLabel = hoursAgo < 1 ? "just now" : `${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago`;

  return (
    <div className={`rounded-xl border p-6 ${ALERT_COLORS[alert.alert_type]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${ALERT_BADGES[alert.alert_type]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[#1A3226]">
              Market Shift — {territory?.city_town}, {territory?.state_id}
            </h3>
            <p className="text-xs text-[#1A3226]/50">{timeLabel}</p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="text-[#1A3226]/40 hover:text-[#1A3226] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-[#1A3226]/80 leading-relaxed mb-4">
        {alert.summary_text}
      </p>

      {alert.relevant_client_ids?.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-white/50 border border-[#1A3226]/10">
          <p className="text-xs font-semibold text-[#1A3226] mb-2">
            {alert.relevant_client_ids.length} clients in your sphere may want to know:
          </p>
          <div className="space-y-1">
            {alert.relevant_client_ids.slice(0, 3).map((clientId, idx) => (
              <p key={idx} className="text-xs text-[#1A3226]/70">
                • Client {idx + 1} — relevant property owner
              </p>
            ))}
            {alert.relevant_client_ids.length > 3 && (
              <p className="text-xs text-[#1A3226]/50 italic">
                +{alert.relevant_client_ids.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8"
          onClick={() => onAction(alert.id, "ran_analysis")}
        >
          <FileText className="w-3 h-3 mr-1" /> Market Report
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8"
          onClick={() => onAction(alert.id, "contacted_clients")}
        >
          <MessageSquare className="w-3 h-3 mr-1" /> Contact Clients
        </Button>
      </div>
    </div>
  );
}