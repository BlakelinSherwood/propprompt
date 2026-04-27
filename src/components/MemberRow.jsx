const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
  pending_invite: "bg-amber-50 text-amber-700",
};

const STATUS_LABELS = {
  active: "active",
  suspended: "suspended",
  pending: "pending",
  pending_invite: "invite pending",
};

const ROLE_COLORS = {
  platform_owner: "bg-[#B8982F]/10 text-[#B8982F]",
  brokerage_admin: "bg-[#1A3226]/10 text-[#1A3226]",
  team_lead: "bg-blue-50 text-blue-700",
  agent: "bg-gray-100 text-gray-600",
  assistant: "bg-purple-50 text-purple-600",
  team_agent: "bg-gray-100 text-gray-600",
};

import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { MoreHorizontal, UserX, XCircle } from "lucide-react";

export default function MemberRow({ member, roleLabels, canManage, onActionDone }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = (member.full_name || member.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isPending = member.status === 'pending_invite';

  async function handleAction() {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      await base44.functions.invoke("revokeMemberAccess", {
        targetEmail: member.email,
        action: isPending ? 'cancel_invite' : 'revoke',
      });
      onActionDone?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-5 py-4 border-b border-[#1A3226]/5 last:border-0 hover:bg-[#FAF8F4]/50 transition-colors">
      <div className="sm:col-span-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
          isPending ? 'bg-amber-100 text-amber-600 border-2 border-dashed border-amber-300' : 'bg-[#1A3226] text-white'
        }`}>
          {initials}
        </div>
        <span className={`text-sm font-medium truncate ${isPending ? 'text-[#1A3226]/40 italic' : 'text-[#1A3226]'}`}>
          {member.full_name || (isPending ? 'Invited user' : '—')}
        </span>
      </div>
      <div className="sm:col-span-3 text-sm text-[#1A3226]/60 truncate pl-12 sm:pl-0">
        {member.email}
      </div>
      <div className="sm:col-span-2 pl-12 sm:pl-0">
        <span className={`inline-flex text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[member.role] || "bg-gray-100 text-gray-600"}`}>
          {roleLabels[member.role] || member.role || "—"}
        </span>
      </div>
      <div className="sm:col-span-2 pl-12 sm:pl-0">
        <span className={`inline-flex text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[member.status] || STATUS_STYLES.active}`}>
          {STATUS_LABELS[member.status] || member.status || "active"}
        </span>
      </div>
      <div className="sm:col-span-1 flex justify-end pl-12 sm:pl-0">
        {canManage && (
          confirming ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAction}
                disabled={busy}
                className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {busy ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-[10px] text-[#1A3226]/40 hover:text-[#1A3226]/70 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={handleAction}
              title={isPending ? 'Cancel invite' : 'Revoke access'}
              className="p-1.5 rounded-md text-[#1A3226]/25 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              {isPending ? <XCircle className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
            </button>
          )
        )}
      </div>
    </div>
  );
}