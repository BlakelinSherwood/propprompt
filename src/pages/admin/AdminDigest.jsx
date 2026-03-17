import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle, TrendingUp, Mail, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SEVERITY_COLORS = {
  urgent: 'border-red-200 bg-red-50',
  review: 'border-yellow-200 bg-yellow-50',
  info: 'border-blue-200 bg-blue-50',
};

const SEVERITY_ICONS = {
  urgent: <AlertCircle className="w-5 h-5 text-red-600" />,
  review: <AlertCircle className="w-5 h-5 text-yellow-600" />,
  info: <TrendingUp className="w-5 h-5 text-blue-600" />,
};

export default function AdminDigest() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [digestRun, setDigestRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDigest();
  }, [selectedDate]);

  async function loadDigest() {
    setLoading(true);
    try {
      const runs = await base44.asServiceRole.entities.AdminDigestRun.filter({
        run_date: selectedDate,
      }, '-run_completed_at', 1);

      if (runs && runs.length > 0) {
        setDigestRun(runs[0]);
      }

      const digestItems = await base44.asServiceRole.entities.AdminDigestItem.filter({
        digest_date: selectedDate,
      }, '-created_at', 100);

      setItems(digestItems || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail(item) {
    if (!item.draft_email_subject || !item.draft_email_body) return;

    try {
      await base44.functions.invoke('sendAdminDraftEmail', {
        item_id: item.id,
        subject: item.draft_email_subject,
        body: item.draft_email_body,
        to_user_id: item.subject_user_id,
      });

      await base44.asServiceRole.entities.AdminDigestItem.update(item.id, {
        action_taken: 'email_sent',
        action_taken_at: new Date().toISOString(),
      });

      loadDigest();
    } catch (err) {
      console.error('Failed to send email:', err);
    }
  }

  async function dismissItem(item, reason) {
    try {
      await base44.asServiceRole.entities.AdminDigestItem.update(item.id, {
        dismissed: true,
        dismissed_at: new Date().toISOString(),
        dismissed_reason: reason,
      });

      loadDigest();
    } catch (err) {
      console.error('Failed to dismiss item:', err);
    }
  }

  const urgent = items.filter(i => i.severity === 'urgent');
  const review = items.filter(i => i.severity === 'review');
  const allClear = urgent.length === 0 && review.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Admin Digest</h1>
          <p className="text-sm text-[#1A3226]/60 mt-1">Daily territory monitoring and operational health</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-[#1A3226]/20 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <>
          {digestRun && (
            <div className="bg-[#1A3226] text-white rounded-lg p-4">
              <p className="text-sm">
                <strong>Run Completed:</strong> {new Date(digestRun.run_completed_at).toLocaleTimeString()} •
                <strong className="ml-3">Items:</strong> {digestRun.items_generated} •
                <strong className="ml-3">MRR:</strong> ${digestRun.mrr_snapshot?.toLocaleString() || 0}
              </p>
            </div>
          )}

          {allClear && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-semibold text-green-900">All Clear</p>
              <p className="text-sm text-green-700 mt-1">No issues detected today</p>
            </div>
          )}

          {urgent.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-red-700">🚨 URGENT ({urgent.length})</h2>
              {urgent.map((item) => (
                <DigestItem key={item.id} item={item} onSendEmail={sendEmail} onDismiss={dismissItem} />
              ))}
            </div>
          )}

          {review.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-yellow-700">⚠️ REVIEW THIS WEEK ({review.length})</h2>
              {review.map((item) => (
                <DigestItem key={item.id} item={item} onSendEmail={sendEmail} onDismiss={dismissItem} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DigestItem({ item, onSendEmail, onDismiss }) {
  const [showDismiss, setShowDismiss] = useState(false);

  return (
    <div className={`rounded-lg border-2 p-4 ${SEVERITY_COLORS[item.severity]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3 flex-1">
          {SEVERITY_ICONS[item.severity]}
          <div className="flex-1">
            <p className="font-semibold text-[#1A3226]">{item.summary}</p>
            <p className="text-sm text-[#1A3226]/70 mt-1">{item.recommended_action}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {item.draft_email_subject && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSendEmail(item)}
              className="gap-2"
            >
              <Mail className="w-4 h-4" /> Send
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDismiss(!showDismiss)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {item.draft_email_subject && (
        <div className="mt-3 text-xs bg-white bg-opacity-50 rounded p-2">
          <p className="font-semibold">Draft email subject:</p>
          <p>{item.draft_email_subject}</p>
        </div>
      )}

      {showDismiss && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold">Dismiss reason:</p>
          <div className="flex gap-2">
            {['resolved', 'false_alarm', 'defer_to_next_week', 'other'].map((reason) => (
              <Button
                key={reason}
                size="sm"
                variant="ghost"
                onClick={() => {
                  onDismiss(item, reason);
                  setShowDismiss(false);
                }}
                className="text-xs"
              >
                {reason}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}