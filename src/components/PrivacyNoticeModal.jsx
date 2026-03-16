import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, Eye } from "lucide-react";

const PRIVACY_NOTICE = `## PropPrompt™ Privacy Notice & Data Use Agreement

**Effective Date:** January 1, 2026
**Developed by:** Sherwood & Company, Brokered by Compass

### What We Collect
- Property addresses and transaction intake data entered during analysis sessions
- AI-generated analysis outputs and associated metadata
- Session logs, login timestamps, and device/IP information for security and compliance

### How We Use Your Data
Your analysis data is used solely to generate AI-powered real estate analyses. We do **not** sell, share, or license your data to third parties.

### Data Visibility Rules
- **Your analyses:** Visible only to you, unless shared explicitly
- **Private analyses:** If your organization allows it, you may mark analyses as private. Private analyses hide output text from brokerage admins and team leads; only address, date, and type are visible to them.
- **Platform owner:** PropPrompt™ platform administrators see **aggregate statistics only** — never individual analysis content, addresses, prompts, or outputs.
- **Fair housing reviews:** Stored permanently per regulatory requirements. Content is visible only to the designated reviewer and is immutable after signing.

### AI API Keys
- Personal API keys you enter are encrypted with AES-256-GCM before storage
- Keys are decrypted only at runtime on secure servers
- Keys are never transmitted to or stored by frontend clients

### Data Retention
- Analyses: Retained for the life of your subscription + 3 years for compliance
- Privacy logs: Permanent (append-only audit trail)
- Fair housing reviews: Permanent per state licensing requirements

### Your Rights
- Request a full export of your analysis data at any time (contact your admin)
- Request account deletion (subject to compliance hold periods)
- Review the complete privacy log for your account in your profile settings

### Contact
For privacy questions: compliance@sherwoodcompany.com

---
*This notice is provided pursuant to MA 201 CMR 17.00 (Data Security Regulations), GDPR Article 13 (for applicable international users), and the PropPrompt™ Terms of Service.*`;

export default function PrivacyNoticeModal({ user, onAccepted }) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Show if user hasn't accepted yet (stored on user metadata)
    if (!user.privacy_notice_accepted_at) {
      setOpen(true);
    }
  }, [user?.id]);

  async function handleAccept() {
    setSaving(true);
    await base44.auth.updateMe({ privacy_notice_accepted_at: new Date().toISOString() });
    // Log to privacy log
    await base44.functions.invoke("logPrivacyEvent", {
      event_type: "privacy_notice_accepted",
      metadata: { notice_version: "2026-01-01" },
    });
    setSaving(false);
    setOpen(false);
    onAccepted?.();
  }

  if (!open) return null;

  return (
    <Dialog open modal>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1A3226]">
            <Shield className="w-5 h-5 text-[#B8982F]" />
            Privacy Notice & Data Use Agreement
          </DialogTitle>
          <p className="text-xs text-[#1A3226]/50">Please read and accept before continuing</p>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-[#1A3226]/[0.03] border border-[#1A3226]/8 text-xs text-[#1A3226]/60">
          <div className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> AES-256 encrypted storage</div>
          <div className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Aggregate-only platform analytics</div>
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> MA 201 CMR 17.00 compliant</div>
        </div>

        <ScrollArea className="flex-1 border border-[#1A3226]/10 rounded-xl p-5 bg-[#FAF8F4] text-sm">
          <div className="prose prose-sm max-w-none prose-headings:text-[#1A3226] prose-p:text-[#1A3226]/80">
            {PRIVACY_NOTICE.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-[#1A3226] mt-4 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-[#1A3226] mt-3 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-[#1A3226] text-xs">{line.slice(2, -2)}</p>;
              if (line.startsWith('- ')) return <li key={i} className="text-xs text-[#1A3226]/70 ml-4">{line.slice(2)}</li>;
              if (line.startsWith('*') && line.endsWith('*')) return <p key={i} className="text-xs text-[#1A3226]/40 italic mt-4">{line.slice(1, -1)}</p>;
              if (line === '---') return <hr key={i} className="border-[#1A3226]/10 my-3" />;
              if (!line.trim()) return <br key={i} />;
              return <p key={i} className="text-xs text-[#1A3226]/70 leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
            })}
          </div>
        </ScrollArea>

        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-2">
            <Checkbox id="accept" checked={accepted} onCheckedChange={setAccepted} />
            <label htmlFor="accept" className="text-xs text-[#1A3226]/70 leading-relaxed cursor-pointer">
              I have read and understood the PropPrompt™ Privacy Notice and Data Use Agreement.
              I consent to the collection and use of my data as described above.
            </label>
          </div>
          <Button
            className="w-full bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
            onClick={handleAccept}
            disabled={!accepted || saving}
          >
            <Shield className="w-4 h-4" />
            {saving ? "Recording acceptance…" : "Accept & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}