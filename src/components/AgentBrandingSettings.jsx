import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, CheckCircle, Loader2, X, User } from "lucide-react";

const SIGNATURE_STYLES = [
  {
    key: 'name_only',
    label: 'Name Only',
    preview: (b) => (
      <div style={{ fontFamily: 'Calibri, sans-serif', fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{b.display_name || 'Agent Name'}</div>
      </div>
    ),
  },
  {
    key: 'name_title',
    label: 'Name + Title',
    preview: (b) => (
      <div style={{ fontFamily: 'Calibri, sans-serif', fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{b.display_name || 'Agent Name'}</div>
        <div style={{ color: '#666', fontSize: 10 }}>{b.title || 'Real Estate Advisor'}</div>
      </div>
    ),
  },
  {
    key: 'name_title_contact',
    label: 'Name + Title + Contact',
    preview: (b) => (
      <div style={{ fontFamily: 'Calibri, sans-serif', fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{b.display_name || 'Agent Name'}  |  {b.title || 'Real Estate Advisor'}</div>
        <div style={{ color: '#666', fontSize: 10 }}>{b.direct_phone || '(617) 555-0100'}  |  {b.direct_email || 'agent@email.com'}</div>
        {b.license_number && <div style={{ color: '#888', fontSize: 10 }}>License: {b.license_number}</div>}
      </div>
    ),
  },
  {
    key: 'full_with_headshot',
    label: 'Full with Headshot',
    preview: (b) => (
      <div style={{ fontFamily: 'Calibri, sans-serif', fontSize: 11, display: 'flex', gap: 10 }}>
        {b.headshot_url
          ? <img src={b.headshot_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
          : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18, color: '#9ca3af' }}>👤</span>
            </div>
        }
        <div>
          <div style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{b.display_name || 'Agent Name'}</div>
          <div style={{ color: '#666', fontSize: 10 }}>{b.title || 'Real Estate Advisor'}</div>
          <div style={{ color: '#666', fontSize: 10 }}>{b.direct_phone || '(617) 555-0100'}  |  {b.direct_email || 'agent@email.com'}</div>
          {b.personal_tagline && <div style={{ color: '#999', fontSize: 10, fontStyle: 'italic' }}>{b.personal_tagline}</div>}
        </div>
      </div>
    ),
  },
];

export default function AgentBrandingSettings() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    display_name: '', title: '', headshot_url: '',
    direct_phone: '', direct_email: '', license_number: '',
    personal_tagline: '', signature_style: 'name_title_contact',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      return base44.entities.AgentBranding.filter({ user_email: me.email });
    }).then(res => {
      if (res[0]) {
        setExistingId(res[0].id);
        setForm({
          display_name: res[0].display_name || '',
          title: res[0].title || '',
          headshot_url: res[0].headshot_url || '',
          direct_phone: res[0].direct_phone || '',
          direct_email: res[0].direct_email || '',
          license_number: res[0].license_number || '',
          personal_tagline: res[0].personal_tagline || '',
          signature_style: res[0].signature_style || 'name_title_contact',
        });
      }
    }).catch(() => {});
  }, []);

  const handleHeadshotUpload = async (file) => {
    if (!file || file.size > 2 * 1024 * 1024) return alert('Headshot must be under 2MB');
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, headshot_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { user_email: user.email, ...form };
    if (existingId) {
      await base44.entities.AgentBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.AgentBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <p className="text-xs text-[#1A3226]/50">
          This branding appears on PDFs, presentations, and emailed reports — not in the PropPrompt app itself.
        </p>
      </div>

      {/* Headshot */}
      <div>
        <h3 className="text-sm font-semibold text-[#1A3226] mb-3">Headshot or Personal Logo</h3>
        <div className="flex items-center gap-5">
          {form.headshot_url ? (
            <img src={form.headshot_url} alt="Headshot" className="w-16 h-16 rounded-full object-cover border-2 border-[#1A3226]/20" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1A3226]/10 flex items-center justify-center">
              <User className="w-7 h-7 text-[#1A3226]/30" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {form.headshot_url ? 'Replace' : 'Upload'}
            </Button>
            {form.headshot_url && (
              <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600" onClick={() => set('headshot_url')('')}>
                <X className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
            <p className="text-xs text-[#1A3226]/40">PNG or JPG, max 2MB. Square crop recommended.</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={e => e.target.files[0] && handleHeadshotUpload(e.target.files[0])} />
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: 'display_name', label: 'Display Name', placeholder: user?.full_name || 'Your full name' },
          { key: 'title', label: 'Title / Designation', placeholder: 'Senior Real Estate Advisor' },
          { key: 'direct_phone', label: 'Direct Phone', placeholder: '(617) 555-0100' },
          { key: 'direct_email', label: 'Direct Email', placeholder: user?.email || 'you@example.com' },
          { key: 'license_number', label: 'License Number (optional)', placeholder: 'RE12345' },
          { key: 'personal_tagline', label: 'Personal Tagline (optional)', placeholder: 'Serving Boston for 15+ years' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-medium text-[#1A3226]/70 block mb-1">{label}</label>
            <Input value={form[key] || ''} onChange={e => set(key)(e.target.value)} placeholder={placeholder} className="text-sm" />
          </div>
        ))}
      </div>

      {/* Signature style selector */}
      <div>
        <h3 className="text-sm font-semibold text-[#1A3226] mb-3">Signature Style</h3>
        <p className="text-xs text-[#1A3226]/50 mb-4">Choose how your signature block appears at the end of documents and emails.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SIGNATURE_STYLES.map(style => (
            <button
              key={style.key}
              onClick={() => set('signature_style')(style.key)}
              className={`border-2 rounded-xl p-4 text-left transition-all ${
                form.signature_style === style.key
                  ? 'border-[#1A3226] bg-[#1A3226]/5'
                  : 'border-[#1A3226]/15 hover:border-[#1A3226]/30'
              }`}
            >
              <div className="text-xs font-semibold text-[#1A3226] mb-3">{style.label}</div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 text-left">
                <div className="border-t-2 border-gray-400 pt-2 mb-1" />
                {style.preview(form)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save My Branding'}
      </Button>
    </div>
  );
}