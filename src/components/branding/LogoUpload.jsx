import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload, X } from "lucide-react";

function UploadField({ label, helper, currentUrl, onUpload, onRemove, accept, maxMb, circular }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File too large. Max ${maxMb}MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpload(file_url);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#1A3226]/70 uppercase tracking-wide">{label}</label>
      {currentUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={currentUrl}
            alt="preview"
            style={{
              maxWidth: circular ? 80 : 120,
              maxHeight: circular ? 80 : 60,
              borderRadius: circular ? "50%" : 6,
              objectFit: "cover",
              border: "1px solid rgba(26,50,38,0.1)"
            }}
          />
          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#1A3226]/25 rounded-lg text-sm text-[#1A3226]/60 hover:border-[#1A3226]/50 hover:text-[#1A3226] transition-all"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <p className="text-[11px] text-[#1A3226]/45">{helper}</p>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export default function LogoUpload({ logoUrl, headshotUrl, onLogoChange, onHeadshotChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <UploadField
        label="Organization Logo"
        helper="Appears in report headers. Transparent PNG recommended."
        currentUrl={logoUrl}
        onUpload={onLogoChange}
        onRemove={() => onLogoChange(null)}
        accept=".png,.jpg,.jpeg,.svg"
        maxMb={5}
        circular={false}
      />
      <UploadField
        label="Default Agent Headshot"
        helper="Used as the fallback headshot in report signature blocks when agents haven't uploaded their own."
        currentUrl={headshotUrl}
        onUpload={onHeadshotChange}
        onRemove={() => onHeadshotChange(null)}
        accept=".png,.jpg,.jpeg"
        maxMb={5}
        circular={true}
      />
    </div>
  );
}