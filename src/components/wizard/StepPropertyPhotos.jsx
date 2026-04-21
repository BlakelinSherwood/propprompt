import { useState } from "react";
import { Camera, Upload, X, Loader2, Image, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const MAX_PHOTOS = 8;

export default function StepPropertyPhotos({ intake, update, onNext, onBack }) {
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const photos = intake.listing_photos || [];

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    update({ listing_photos: [...photos, ...newUrls] });
    setUploading(false);
  }

  function removePhoto(url) {
    update({ listing_photos: photos.filter(p => p !== url) });
  }

  async function handleFetchOnline() {
    if (!intake.address) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Search online for the most recently marketed listing photos for this property: "${intake.address}". 
Look on Zillow, Redfin, Realtor.com, Compass, and MLS sites. 
Return ONLY a JSON array of up to 6 direct image URLs that are publicly accessible photos of this specific property's interior and exterior.
If you cannot find real listing photos, return an empty array [].
Return ONLY the JSON array, nothing else.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            photo_urls: { type: "array", items: { type: "string" } },
            source: { type: "string" },
            found: { type: "boolean" }
          }
        }
      });
      const urls = (res?.photo_urls || []).filter(u => u && u.startsWith("http")).slice(0, 6);
      if (urls.length > 0) {
        update({ listing_photos: [...photos, ...urls].slice(0, MAX_PHOTOS), photos_source: "online" });
      } else {
        setFetchError("No publicly accessible listing photos found online for this address. Please upload photos manually.");
      }
    } catch (e) {
      setFetchError("Could not fetch photos online. Please upload manually.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 5</p>
        <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Property Photos
        </h2>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          Photos help the AI assess condition, finish level, and renovation quality — improving valuation accuracy. 
          Upload your own or let PropPrompt find recent listing photos online.
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Upload */}
        <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${uploading ? "border-[#1A3226]/20 opacity-60" : "border-[#1A3226]/20 hover:border-[#B8982F]/50 hover:bg-[#FAF8F4]"}`}>
          {uploading ? <Loader2 className="w-6 h-6 text-[#1A3226]/40 animate-spin" /> : <Upload className="w-6 h-6 text-[#1A3226]/40" />}
          <span className="text-sm font-medium text-[#1A3226]/70">{uploading ? "Uploading…" : "Upload Photos"}</span>
          <span className="text-xs text-[#1A3226]/40">JPG, PNG — up to {MAX_PHOTOS} photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading || photos.length >= MAX_PHOTOS}
            onChange={handleFileUpload}
          />
        </label>

        {/* Fetch online */}
        <button
          onClick={handleFetchOnline}
          disabled={fetching || !intake.address || photos.length >= MAX_PHOTOS}
          className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#1A3226]/20 hover:border-[#B8982F]/50 hover:bg-[#FAF8F4] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fetching ? <Loader2 className="w-6 h-6 text-[#1A3226]/40 animate-spin" /> : <ExternalLink className="w-6 h-6 text-[#1A3226]/40" />}
          <span className="text-sm font-medium text-[#1A3226]/70">{fetching ? "Searching online…" : "Find Online Listing Photos"}</span>
          <span className="text-xs text-[#1A3226]/40">Searches Zillow, Redfin, Compass & MLS</span>
        </button>
      </div>

      {fetchError && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {fetchError}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div>
          <p className="text-xs text-[#1A3226]/50 mb-3">{photos.length} photo{photos.length !== 1 ? "s" : ""} added — AI will analyze these for condition, finish level, and renovation quality.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((url, i) => (
              <div key={url + i} className="relative group rounded-xl overflow-hidden border border-[#1A3226]/10 aspect-square bg-gray-100">
                <img
                  src={url}
                  alt={`Property photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = "none"; }}
                />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-1.5 left-1.5">
                  <span className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">#{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="flex items-center gap-3 bg-[#FAF8F4] rounded-xl border border-[#1A3226]/8 px-4 py-4">
          <Image className="w-5 h-5 text-[#1A3226]/30 flex-shrink-0" />
          <p className="text-xs text-[#1A3226]/50">
            No photos added yet. Photos are optional but significantly improve condition scoring accuracy. 
            Without photos, the AI will default all comps to "Similar" condition.
          </p>
        </div>
      )}

      {/* Condition override if no photos */}
      {photos.length === 0 && (
        <div>
          <label className="text-xs font-medium text-[#1A3226]/60 block mb-2">
            Property Condition / Renovation Level <span className="text-[#1A3226]/40">(used if no photos)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "fully_renovated", label: "Fully Renovated", desc: "New kitchen, baths, finishes" },
              { id: "updated", label: "Updated", desc: "Significant improvements made" },
              { id: "original_good", label: "Original — Good", desc: "Well maintained, no major updates" },
              { id: "needs_work", label: "Needs Work", desc: "Below average condition" },
            ].map(c => (
              <button
                key={c.id}
                onClick={() => update({ condition_override: c.id })}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left
                  ${intake.condition_override === c.id
                    ? "border-[#B8982F] bg-[#B8982F]/10 text-[#B8982F]"
                    : "border-[#1A3226]/15 text-[#1A3226]/60 hover:border-[#1A3226]/30"}`}
              >
                <div>{c.label}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[#1A3226]/8 pt-5">
        <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/30 transition-all">← Back</button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl bg-[#1A3226] text-white text-sm font-semibold hover:bg-[#1A3226]/90 transition-all shadow-sm"
        >
          {photos.length > 0 ? "Continue with Photos →" : "Skip Photos →"}
        </button>
      </div>
    </div>
  );
}