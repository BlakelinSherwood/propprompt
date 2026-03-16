import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, AlertTriangle, Save, CheckCircle, Loader2, X } from "lucide-react";
import BrandingPreview from "../../BrandingPreview";

function contrastWithWhite(hex) {
  if (!hex || hex.length < 7) return 21;
  try {
    const toLinear = v => { const s = parseInt(v, 16) / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const r = toLinear(hex.slice(1, 3)), g = toLinear(hex.slice(3, 5)), b = toLinear(hex.slice(5, 7));
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
  } catch { return 21; }
}

function ColorField({ label, value, onChange }) {
  const contrast = contrastWithWhite(value);
  const lowContrast = contrast < 4.5;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#1A3226]/70">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#333333'}
          onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-md border border-[#1A3226]/20 cursor-pointer p-0.5"
        />
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#333333"
          className="font-mono text-sm w-32"
          maxLength={7}
        />
        {lowContrast && (
          <span className="flex items-center gap-1 text-amber-600 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Low contrast — white text may be hard to read
          </span>
        )}
      </div>
    </div>
  );
}

export default function BrokerageBrandingTab({ org, user }) {
  const [branding, setBranding] = useState({
    org_name: '', logo_url: '', primary_color: '#333333',
    accent_color: '#666666', background_color: '#FFFFFF',
    address: '', phone: '', website: '', tagline: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!org?.id) return;
    base44.entities.OrgBranding.filter({ org_id: org.id }).then(res => {
      if (res[0]) {
        setExistingId(res[0].id);
        setBranding({
          org_name: res[0].org_name || org.name || '',
          logo_url: res[0].logo_url || '',
          primary_color: res[0].primary_color || '#333333',
          accent_color: res[0].accent_color || '#666666',
          background_color: res[0].background_color || '#FFFFFF',
          address: res[0].address || '',
          phone: res[0].phone || '',
          website: res[0].website || '',
          tagline: res[0].tagline || '',
        });
      } else {
        setBranding(b => ({ ...b, org_name: org.name || '' }));
      }
    }).catch(() => {});
  }, [org?.id]);

  const handleLogoUpload = async (file) => {
    if (!file || file.size > 2 * 1024 * 1024) return alert('Logo must be under 2MB');
    setLogoUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setBranding(b => ({ ...b, logo_url: file_url }));
    setLogoUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { org_id: org.id, ...branding };
    if (existingId) {
      await base44.entities.OrgBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.OrgBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (k) => (v) => setBranding(b => ({ ...b, [k]: v }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
      {/* Left: settings */}
      <div className="space-y-7">
        <div>
          <h3 className="text-sm font-semibold text-[#1A3226] mb-1">Logo</h3>
          <p className="text-xs text-[#1A3226]/50 mb-3">PNG, JPG, or SVG — max 2MB. This logo appears on all output documents for this brokerage.</p>
          {branding.logo_url ? (
            <div className="flex items-center gap-3">
              <img src={branding.logo_url} alt="Logo" className="h-12 max-w-[120px] object-contain rounded border border-[#1A3226]/10 p-1 bg-white" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => fileRef.current?.click()}>Replace</Button>
                <Button variant="outline" size="sm" className="text-xs text-red-600" onClick={() => setBranding(b => ({ ...b, logo_url: '' }))}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-[#1A3226]/20 rounded-xl p-8 text-center hover:border-[#1A3226]/40 transition-colors"
            >
              {logoUploading
                ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1A3226]/40" />
                : <><Upload className="w-6 h-6 mx-auto mb-2 text-[#1A3226]/40" /><p className="text-sm text-[#1A3226]/50">Click or drag to upload logo</p></>
              }
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
            onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1A3226]">Colors</h3>
          <ColorField label="Primary Color — header bars, headings, table headers" value={branding.primary_color} onChange={set('primary_color')} />
          <ColorField label="Accent Color — dividers, callout borders, highlights" value={branding.accent_color} onChange={set('accent_color')} />
          <ColorField label="Background Color — document background" value={branding.background_color} onChange={set('background_color')} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A3226]">Organization Info</h3>
          {[
            { key: 'org_name', label: 'Organization Name', placeholder: org?.name },
            { key: 'address', label: 'Address', placeholder: '123 Main St, Boston MA 02101' },
            { key: 'phone', label: 'Phone', placeholder: '(617) 555-0100' },
            { key: 'website', label: 'Website', placeholder: 'www.yourbrokerage.com' },
            { key: 'tagline', label: 'Tagline (optional)', placeholder: 'Your tagline here' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-[#1A3226]/70 block mb-1">{label}</label>
              <Input value={branding[key] || ''} onChange={e => set(key)(e.target.value)} placeholder={placeholder} className="text-sm" />
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Branding'}
        </Button>
      </div>

      {/* Right: live preview */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1A3226] mb-1">Live Document Preview</h3>
          <p className="text-xs text-[#1A3226]/50 mb-4">Updates in real time as you change settings. This is how output documents will look.</p>
        </div>
        <BrandingPreview branding={branding} />
        <p className="text-xs text-[#1A3226]/40 text-center">PropPrompt app UI colors are not affected by these settings.</p>
      </div>
    </div>
  );
}