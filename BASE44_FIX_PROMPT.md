# Base44 Fix Prompt — PropPrompt Code Audit Fixes

Copy and paste the sections below into Base44 one at a time (or as a batch if Base44 supports it). Each section is a self-contained fix instruction.

---

## BATCH 1: CRITICAL SECURITY + CRASH FIXES (do these first)

```
Fix the following critical bugs and security issues in the PropPrompt app. Apply each fix carefully:

---

### Fix 1: approveClaim.ts — Authentication Bypass

In `functions/approveClaim.ts`, around lines 50-56, there is a critical auth bypass. When `base44.auth.me()` throws an error, the catch block sets `isAdmin = true`, granting admin access to anyone. Change the catch block so it sets `isAdmin = false` instead of `true`:

BEFORE (broken):
```js
try {
  const user = await base44.auth.me();
  isAdmin = user?.role === 'admin' || user?.role === 'platform_owner';
} catch (_) {
  isAdmin = true; // BUG: grants admin to anyone if auth fails
}
```

AFTER (fixed):
```js
try {
  const user = await base44.auth.me();
  isAdmin = user?.role === 'admin' || user?.role === 'platform_owner';
} catch (_) {
  isAdmin = false;
}
```

---

### Fix 2: PayoffInputCard.jsx — Operator Precedence Bug

In `src/components/payoff/PayoffInputCard.jsx`, around line 43, there is a math operator precedence bug that makes ALL loan payoff calculations wrong. Division binds tighter than subtraction, so the date is divided before subtraction.

BEFORE (broken):
```js
const monthsElapsed = new Date() - new Date(loanDate) / (1000 * 60 * 60 * 24 * 30);
```

AFTER (fixed — add parentheses):
```js
const monthsElapsed = (new Date() - new Date(loanDate)) / (1000 * 60 * 60 * 24 * 30);
```

---

### Fix 3: UrgencyStrip.jsx — Promise.all Crash

In `src/components/landing/UrgencyStrip.jsx`, around line 11, the `.catch()` on `Promise.all` returns `undefined`, and the subsequent destructuring `[all, avail]` from `undefined` crashes with a TypeError.

BEFORE (crashes):
```js
const [all, avail] = await Promise.all([
  base44.entities.Territory.list(),
  base44.entities.Territory.filter({ status: "available" })
]).catch(console.error);
```

AFTER (fixed — return fallback array):
```js
const [all, avail] = await Promise.all([
  base44.entities.Territory.list(),
  base44.entities.Territory.filter({ status: "available" })
]).catch(() => [[], []]);
```

---

### Fix 4: Hardcoded Encryption Key Fallback

In `functions/assemblePrompt.ts` (line 16), `functions/resolveApiKey.ts` (line 13), and `functions/platformAdminPrompts.ts` (line 5), remove the hardcoded fallback encryption key `"default-key-32-bytes-padded-here!!"`. If the ENCRYPTION_KEY env var is missing, throw an error instead of using a publicly known key.

BEFORE (insecure):
```js
const raw = Deno.env.get("ENCRYPTION_KEY") || "default-key-32-bytes-padded-here!!";
```

AFTER (safe):
```js
const raw = Deno.env.get("ENCRYPTION_KEY");
if (!raw) throw new Error("ENCRYPTION_KEY environment variable is required");
```

Apply this same change in ALL files that contain the string `"default-key-32-bytes-padded-here!!"`.

---

### Fix 5: Stream Functions — Add Ownership Verification

In `functions/claudeStream.ts`, `functions/geminiStream.ts`, `functions/grokStream.ts`, and `functions/perplexityStream.ts`, after fetching the analysis record and before proceeding with streaming, add an ownership check. Only `openaiStream.ts` already has this check — the other 4 stream functions are missing it.

Add this check right after `const analysis = records[0];` and `if (!analysis)` check:

```js
// Ownership check
if (analysis.run_by_email !== user.email &&
    analysis.on_behalf_of_email !== user.email &&
    user.role !== 'platform_owner') {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### Fix 6: Mapbox Token — Move to Environment Variable

In `src/components/territories/TerritoryMap.jsx` (line 8) and `src/components/landing/HeroMap.jsx` (line 5), the Mapbox access token is hardcoded. Replace it with an environment variable reference:

BEFORE:
```js
const MAPBOX_TOKEN = "pk.eyJ1IjoiYmxha2VzaGVyd29vZCIs...";
```

AFTER:
```js
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
```

Then add `VITE_MAPBOX_TOKEN` to your Base44 environment variables with the actual token value.

---

### Fix 7: Landing.jsx — XSS via dangerouslySetInnerHTML

In `src/pages/Landing.jsx` around line 350, `founder.founder_statement` is rendered with `dangerouslySetInnerHTML`. Replace it with safe rendering:

BEFORE (XSS vulnerable):
```jsx
<div dangerouslySetInnerHTML={{ __html: founder.founder_statement }} />
```

AFTER (safe — use ReactMarkdown or plain text):
```jsx
<p className="text-sm text-[#1A3226]/70 leading-relaxed whitespace-pre-line">
  {founder.founder_statement}
</p>
```

---

### Fix 8: searchPublicRecords.ts — Broken Client

In `functions/searchPublicRecords.ts`, the `invokeAISearch` function creates a client with an empty object `createClientFromRequest({})` which breaks all AI searches. Change the function to accept and use the authenticated base44 client:

BEFORE (broken):
```js
async function invokeAISearch(prompt) {
  const base44 = createClientFromRequest({});
  // ...
}
```

AFTER (fixed — pass client through):
```js
async function invokeAISearch(prompt, base44) {
  // use the passed-in authenticated client
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      // ...rest of the existing schema
    });
    return response;
  } catch (error) {
    console.error('[searchPublicRecords] AI search error:', error);
    return { search_status: 'error', search_notes: `Search failed: ${error.message}` };
  }
}
```

Then update ALL 4 callers (`searchMassachusetts`, `searchMaine`, `searchNewHampshire`, `searchVermont`) to accept and pass the `base44` client:

```js
async function searchMassachusetts(address, base44) {
  // ... existing prompt ...
  return await invokeAISearch(prompt, base44);
}
```

And update `searchRecordsByState` to pass `base44` through:
```js
results = await searchMassachusetts(address, base44);
// same for searchMaine, searchNewHampshire, searchVermont
```

---

### Fix 9: OAuth CSRF — Use Random State Token

In `functions/driveOauthStart.ts`, generate a random CSRF token instead of using the user's email as the OAuth `state` parameter. Store it in a temporary entity so `driveOauthCallback.ts` can verify it.

In `driveOauthStart.ts`:
```js
// Generate CSRF token
const csrfToken = crypto.randomUUID();
// Store token → email mapping
await base44.asServiceRole.entities.OAuthState.create({
  token: csrfToken,
  user_email: user.email,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
});
// Use token as state parameter
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...&state=${csrfToken}`;
```

In `driveOauthCallback.ts`:
```js
const { code, state: csrfToken } = body;
// Verify CSRF token
const stateRecords = await base44.asServiceRole.entities.OAuthState.filter({ token: csrfToken });
const stateRecord = stateRecords[0];
if (!stateRecord || stateRecord.expires_at < new Date().toISOString()) {
  return Response.json({ error: 'Invalid or expired state token' }, { status: 400 });
}
const userEmail = stateRecord.user_email;
// Delete used token
await base44.asServiceRole.entities.OAuthState.delete(stateRecord.id);
```

This requires creating an `OAuthState` entity with fields: `token` (string), `user_email` (string), `created_at` (datetime), `expires_at` (datetime).

---

### Fix 10: CRM Push — SSRF Protection

In `functions/crmPush.ts`, add URL validation before making fetch calls to CRM endpoints. Only allow known CRM domains:

Add this validation function at the top of the file:
```js
const ALLOWED_CRM_DOMAINS = [
  'followupboss.com',
  'api.followupboss.com',
  'kvcore.com',
  'api.kvcore.com',
  'salesforce.com',
  'login.salesforce.com',
  'lofty.com',
  'api.lofty.com',
];

function validateCrmUrl(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    if (!ALLOWED_CRM_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
      throw new Error(`CRM URL domain not allowed: ${domain}`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('CRM URL must use HTTPS');
    }
    return parsed.toString();
  } catch (e) {
    throw new Error(`Invalid CRM URL: ${e.message}`);
  }
}
```

Then call `validateCrmUrl(instanceUrl)` before every `fetch()` call to a CRM endpoint.
```

---

## BATCH 2: HIGH SEVERITY FIXES

```
Fix the following high-severity bugs in the PropPrompt app:

---

### Fix 11: App.jsx — Remove Duplicate Route

In `src/App.jsx`, line 81 is a duplicate of line 80. Remove the duplicate:

```jsx
<Route path="/team/:id/branding" element={<TeamBranding />} />
<Route path="/team/:id/branding" element={<TeamBranding />} />  ← DELETE THIS LINE
```

---

### Fix 12: NewAnalysis.jsx — Add Quota Check + Error Handling

In `src/pages/NewAnalysis.jsx`, the `handleSubmit` function needs:
1. A quota check before creating the analysis
2. try/catch with error handling

BEFORE:
```js
async function handleSubmit() {
  setSubmitting(true);
  const analysis = await base44.entities.Analysis.create({ ... });
  navigate(`/AnalysisRun?id=${analysis.id}`);
}
```

AFTER:
```js
async function handleSubmit() {
  setSubmitting(true);
  try {
    // Check quota first
    const quotaRes = await base44.functions.invoke("checkAnalysisQuota", {});
    if (!quotaRes.data?.allowed) {
      alert("You've reached your monthly analysis limit. Please upgrade or purchase a top-up pack.");
      setSubmitting(false);
      return;
    }
    const analysis = await base44.entities.Analysis.create({ ... });
    navigate(`/AnalysisRun?id=${analysis.id}`);
  } catch (err) {
    console.error("Failed to create analysis:", err);
    alert("Failed to create analysis. Please try again.");
    setSubmitting(false);
  }
}
```

---

### Fix 13: claudeStream.ts — Add Quota Deduction

In `functions/claudeStream.ts`, after the streaming completes successfully and the analysis is saved as "complete" (around line 112), add a call to deduct the analysis quota:

```js
// After updating analysis to "complete"
await base44.asServiceRole.entities.Analysis.update(analysisId, {
  status: "complete",
  output_text: fullOutput,
  completed_at: new Date().toISOString(),
  ai_model: model,
  intake_data: { ...analysis.intake_data, api_key_source: keySource },
});

// Deduct quota
try {
  await base44.functions.invoke("deductAnalysisQuota", {
    analysisId,
    orgId: analysis.org_id,
  });
} catch (e) {
  console.warn("[claudeStream] quota deduction failed:", e.message);
}
```

Apply the same quota deduction to ALL other stream functions: `geminiStream.ts`, `grokStream.ts`, `perplexityStream.ts`, `openaiStream.ts` (in both the o3 and streaming branches), and `chatgptStream.ts`.

---

### Fix 14: AnalysisRun.jsx — Add Error Handling to All Handlers

In `src/pages/AnalysisRun.jsx`, wrap every async handler in try/catch:

```js
const handleDownloadPdf = async () => {
  try {
    const res = await base44.functions.invoke("generateDocuments", { analysisId, format: "pdf" });
    if (res.data?.url) window.open(res.data.url, "_blank");
  } catch (err) {
    console.error("PDF download failed:", err);
    alert("Failed to generate PDF. Please try again.");
  }
};

const handleDownloadPptx = async () => {
  setPptxGenerating(true);
  try {
    const res = await base44.functions.invoke("generateDocuments", { analysisId, format: "pptx" });
    if (res.data?.url) { setPptxUrl(res.data.url); window.open(res.data.url, "_blank"); }
  } catch (err) {
    console.error("PPTX generation failed:", err);
    alert("Failed to generate PPTX. Please try again.");
  } finally {
    setPptxGenerating(false);
  }
};

const handleDriveUpload = async () => {
  setDriveUploading(true);
  try {
    const res = await base44.functions.invoke("driveSync", { analysisId });
    if (res.data?.driveUrl) { setDriveUploaded(true); setDriveUrl(res.data.driveUrl); }
  } catch (err) {
    console.error("Drive upload failed:", err);
    alert("Failed to upload to Drive. Please try again.");
  } finally {
    setDriveUploading(false);
  }
};

const handleSendEmail = async () => {
  if (!emailTo) return;
  setEmailSending(true);
  try {
    await base44.functions.invoke("sendAnalysisEmail", { analysisId, toEmail: emailTo });
    setEmailSent(true);
    setTimeout(() => { setEmailDialogOpen(false); setEmailSent(false); setEmailTo(""); }, 1500);
  } catch (err) {
    console.error("Email send failed:", err);
    alert("Failed to send email. Please try again.");
  } finally {
    setEmailSending(false);
  }
};

const handleCrmPush = async () => {
  if (!crmConnections.length) return;
  setCrmPushing(true);
  try {
    const conn = crmConnections[0];
    const res = await base44.functions.invoke("crmPush", { analysisId, connectionId: conn.id });
    if (res.data?.success) setCrmPushed(true);
  } catch (err) {
    console.error("CRM push failed:", err);
    alert("Failed to push to CRM. Please try again.");
  } finally {
    setCrmPushing(false);
  }
};
```

Also in the same file, fix the SSE error response parsing (around line 102):

BEFORE:
```js
const err = await response.json();
```

AFTER:
```js
const err = await response.json().catch(() => ({ error: "Request failed" }));
```

---

### Fix 15: AnalysisRun.jsx — Add Stream Cleanup on Unmount

In `src/pages/AnalysisRun.jsx`, add an AbortController to the useEffect so the stream is cancelled if the user navigates away:

At the start of the useEffect:
```js
useEffect(() => {
  if (!analysisId || hasStarted.current) return;
  hasStarted.current = true;
  const abortController = new AbortController();

  async function loadAndStream() {
    // ... existing code ...

    // Add signal to the fetch call:
    const response = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ analysisId, orgId }),
      signal: abortController.signal,  // ADD THIS
    });

    // ... rest of existing code ...
  }

  loadAndStream().catch(err => {
    if (err.name === 'AbortError') return; // Ignore abort errors
    setErrorMsg(err.message);
    setStatus("error");
  });

  return () => abortController.abort();  // CLEANUP
}, [analysisId]);
```

---

### Fix 16: confirmTopup.ts — Add Idempotency Check

In `functions/confirmTopup.ts`, before creating a TopupPack, check if one already exists for this payment_intent_id:

```js
// Check for duplicate (idempotency)
const existing = await base44.asServiceRole.entities.TopupPack.filter({
  stripe_payment_intent_id: payment_intent_id,
});
if (existing.length > 0) {
  return Response.json({
    success: true,
    pack_id: existing[0].id,
    message: 'Already processed',
  });
}
```

---

### Fix 17: stripeWebhook.ts — Add Idempotency

In `functions/stripeWebhook.ts`, after verifying the webhook signature but before processing, check if this event was already handled:

```js
// Idempotency check
const processedEvents = await base44.asServiceRole.entities.ProcessedWebhookEvent.filter({
  event_id: event.id,
});
if (processedEvents.length > 0) {
  console.log(`Skipping duplicate event: ${event.id}`);
  return Response.json({ received: true, duplicate: true });
}

// ... process the event ...

// After successful processing, record the event
await base44.asServiceRole.entities.ProcessedWebhookEvent.create({
  event_id: event.id,
  event_type: event.type,
  processed_at: new Date().toISOString(),
});
```

This requires creating a `ProcessedWebhookEvent` entity with fields: `event_id` (string, unique), `event_type` (string), `processed_at` (datetime).

---

### Fix 18: generateDocuments.ts — HTML-Escape Email Template

In `functions/generateDocuments.ts`, add an HTML escape function and use it in `buildEmailHtml`:

Add this helper function:
```js
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Then in `buildEmailHtml`, escape all interpolated values:
```js
const orgName = escapeHtml(branding.org_name);
const orgTagline = escapeHtml(branding.org_tagline);
const agentName = escapeHtml(branding.agent_name);
const agentTitle = escapeHtml(branding.agent_title);
const agentPhone = escapeHtml(branding.agent_phone);
const agentEmail = escapeHtml(branding.agent_email);
const assessLabel = escapeHtml(assessmentLabel);
const addr = escapeHtml(address);
// For output text, escape then convert newlines:
const outputText = escapeHtml(analysis.output_text || '').replace(/\n/g, '<br>');
```

Use these escaped variables instead of the raw values in the HTML template.

---

### Fix 19: approveClaim.ts — Fix Stripe Failure Handling

In `functions/approveClaim.ts`, around lines 116-127, don't silently swallow Stripe errors. If payment is required and Stripe fails, fail the claim:

BEFORE:
```js
try {
  const { subscription, customerId } = await createStripeSubscription(...);
  stripeSubId = subscription.id;
  stripeCustomerId = customerId;
} catch (stripeErr) {
  console.error('[approveClaim] Stripe error:', stripeErr.message);
  // Continue without Stripe in test/dev — log but don't fail
}
```

AFTER:
```js
try {
  const { subscription, customerId } = await createStripeSubscription(...);
  stripeSubId = subscription.id;
  stripeCustomerId = customerId;
} catch (stripeErr) {
  console.error('[approveClaim] Stripe error:', stripeErr.message);
  // Only continue without Stripe if payment method was not provided
  if (claim.stripe_payment_method_id) {
    return Response.json({
      error: `Payment failed: ${stripeErr.message}. Claim not approved.`,
    }, { status: 402 });
  }
}
```

Also in the same file, fix the meaningless ternary on line 154:

BEFORE:
```js
const newStatus = allClaimed >= (territory?.seats_total || 1) ? 'active' : 'active';
```

AFTER:
```js
const newStatus = allClaimed >= (territory?.seats_total || 1) ? 'fully_claimed' : 'active';
```

---

### Fix 20: crmConnect.ts — Encrypt CRM API Keys

In `functions/crmConnect.ts`, encrypt the API key before storing:

```js
// Add encryption utility (or import from shared module)
async function encryptKey(plaintext) {
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("ENCRYPTION_KEY required");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(raw.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// Then in the handler, encrypt before storing:
const encryptedKey = api_key ? await encryptKey(api_key) : '';
// Store with:
encrypted_api_key: encryptedKey,
```

---

### Fix 21: geminiStream.ts — Move API Key to Header

In `functions/geminiStream.ts`, around line 66, move the API key from the URL to a header:

BEFORE:
```js
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: ... }
);
```

AFTER:
```js
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: ...
  }
);
```

---

### Fix 22: openaiStream.ts — Remove Wildcard CORS + Fix Prompt Handling

In `functions/openaiStream.ts`:

1. Remove `'Access-Control-Allow-Origin': '*'` from both stream response headers (lines 158 and 213).

2. Don't try to decrypt `prompt_assembled` since it's stored as plaintext. Change line 79:

BEFORE:
```js
const promptText = await decryptData(analysis.prompt_assembled, encKey);
```

AFTER:
```js
const promptText = analysis.prompt_assembled;
```

---

### Fix 23: PlatformAIConfig.jsx — Implement Real Save

In `src/components/admin/platform/PlatformAIConfig.jsx`, replace the fake `setTimeout` save with an actual API call:

BEFORE:
```js
const handleSave = () => {
  setSaving(true);
  setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 1000);
};
```

AFTER:
```js
const handleSave = async () => {
  setSaving(true);
  try {
    await base44.entities.PlatformConfig.update(config.id, formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save configuration.");
  } finally {
    setSaving(false);
  }
};
```

---

### Fix 24: ClaimsTable.jsx — Pass Missing Argument

In `src/components/admin/claims/ClaimsTable.jsx`, find the call to `getTerritorySummary(c)` (around line 134) and pass the second `stateMap` argument:

BEFORE:
```js
getTerritorySummary(c)
```

AFTER:
```js
getTerritorySummary(c, stateMap)
```

---

### Fix 25: TownsMap.jsx — Implement Marker Update Logic

In `src/components/admin/sublicense/TownsMap.jsx`, the useEffect around lines 51-53 has an empty body. Implement the marker update:

```js
useEffect(() => {
  if (!mapRef.current || !territories?.length) return;
  // Clear existing markers
  markersRef.current.forEach(m => m.remove());
  markersRef.current = [];
  // Add updated markers
  territories.forEach(t => {
    if (!t.lat || !t.lng) return;
    const marker = new mapboxgl.Marker({ color: getMarkerColor(t) })
      .setLngLat([t.lng, t.lat])
      .addTo(mapRef.current);
    markersRef.current.push(marker);
  });
}, [territories]);
```

---

### Fix 26: loadStripe — Move to Module Scope

In `src/pages/TopupPage.jsx` and `src/components/claim/PaymentStep.jsx`, move the `loadStripe()` call to module scope:

```js
// At the TOP of the file, outside any component:
import { loadStripe } from "@stripe/stripe-js";
const stripePromise = loadStripe("pk_live_your_key_here");

// Then inside the component, use stripePromise directly:
// Remove any useState/useEffect that calls loadStripe()
// Use: <Elements stripe={stripePromise}>
```

---

### Fix 27: Admin Role Checks — Standardize

In these files, change `user.role === 'admin'` to `user.role === 'platform_owner'`:
- `functions/updatePricingConfig.ts` (line 7)
- `functions/processTerritorySuspension.ts` (line 9)
- `functions/aggregateTerritoryDataQuality.ts` (line 9)
- `src/pages/admin/PricingAdmin.jsx`

The rest of the app uses `'platform_owner'` as the admin role, not `'admin'`.
```

---

## BATCH 3: MEDIUM SEVERITY FIXES

```
Fix the following medium-severity issues in the PropPrompt app:

---

### Fix 28: Use useAuth() Instead of Redundant auth.me() Calls

In these files, replace the manual `base44.auth.me()` call with the existing `useAuth()` hook:

Files to update:
- `src/pages/Dashboard.jsx`
- `src/pages/Analyses.jsx`
- `src/pages/Members.jsx`
- `src/pages/Billing.jsx`
- `src/pages/NewAnalysis.jsx`
- `src/pages/AccountSettings.jsx`

Pattern — BEFORE:
```js
import { base44 } from "@/api/base44Client";
// ...
const [user, setUser] = useState(null);
useEffect(() => {
  const me = await base44.auth.me();
  setUser(me);
  // ...
}, []);
```

Pattern — AFTER:
```js
import { useAuth } from "@/lib/AuthContext";
// ...
const { user } = useAuth();
// Remove the useState for user and the auth.me() call
// Use user directly (it may be null while loading, so guard with user?.xxx)
```

---

### Fix 29: Extract Shared Constants

Create a new file `src/lib/constants.js`:

```js
export const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  brokerage_admin: "Brokerage Admin",
  team_lead: "Team Lead",
  agent: "Agent",
  assistant: "Assistant",
  team_agent: "Team Agent",
};

export const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing Analysis",
  buyer_intelligence: "Buyer Intelligence Report",
  investment_analysis: "Investment Analysis",
  cma: "Comparative Market Analysis",
  rental_analysis: "Rental Analysis",
};

export const STATUS_STYLES = {
  draft: "bg-[#1A3226]/5 text-[#1A3226]/50",
  in_progress: "bg-amber-50 text-amber-600",
  complete: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  archived: "bg-gray-100 text-gray-400",
};
```

Then import from this file in all components that define these locally:
- `src/pages/Dashboard.jsx`
- `src/pages/Members.jsx`
- `src/pages/Analyses.jsx`
- `src/pages/AnalysisRun.jsx`
- `src/components/Layout.jsx`

---

### Fix 30: DataQuality.jsx — Guard Division by Zero

In `src/pages/admin/DataQuality.jsx`, around line 57:

BEFORE:
```js
const avg = enriched.reduce((sum, t) => sum + t.quality_score, 0) / enriched.length;
```

AFTER:
```js
const avg = enriched.length > 0
  ? enriched.reduce((sum, t) => sum + t.quality_score, 0) / enriched.length
  : 0;
```

---

### Fix 31: utils.js — Fix isIframe Cross-Origin Exception

In `src/lib/utils.js`:

BEFORE:
```js
export const isIframe = window.self !== window.top;
```

AFTER:
```js
export const isIframe = (() => {
  try { return window.self !== window.top; }
  catch { return true; }
})();
```

---

### Fix 32: ClaimsAdmin.jsx — Fix Typo

In `src/pages/admin/ClaimsAdmin.jsx`, around line 159:

BEFORE: `rejection_recliam_days`
AFTER: `rejection_reclaim_days`

---

### Fix 33: AnalysisPrivateToggle.jsx — Fix Wrong Event Types

In `src/components/AnalysisPrivateToggle.jsx`, around line 25:

BEFORE:
```js
event_type: newVal ? "analysis_deleted" : "data_export_delivered",
```

AFTER:
```js
event_type: newVal ? "marked_private" : "marked_public",
```

---

### Fix 34: stripeWebhook.ts — Fix Overage Pack Logic

In `functions/stripeWebhook.ts`, around lines 59-69, overage packs should NOT permanently increase the monthly cap. Instead, create a separate TopupPack record:

BEFORE:
```js
if (OVERAGE_PACKS[priceId]) {
  const extraAnalyses = OVERAGE_PACKS[priceId];
  const quotas = await base44.asServiceRole.entities.SeatQuota.filter({ org_id: orgId });
  if (quotas.length > 0) {
    const q = quotas[0];
    await base44.asServiceRole.entities.SeatQuota.update(q.id, {
      analyses_included_per_seat_monthly: (q.analyses_included_per_seat_monthly || 0) + extraAnalyses,
    });
  }
  break;
}
```

AFTER:
```js
if (OVERAGE_PACKS[priceId]) {
  const extraAnalyses = OVERAGE_PACKS[priceId];
  await base44.asServiceRole.entities.TopupPack.create({
    org_id: orgId,
    analyses_remaining: extraAnalyses,
    analyses_total: extraAnalyses,
    source: 'overage_pack',
    stripe_payment_intent_id: session.payment_intent,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    created_at: new Date().toISOString(),
  });
  console.log(`Overage pack created: +${extraAnalyses} analyses for org ${orgId}`);
  break;
}
```

---

### Fix 35: searchPublicRecords.ts — Pass force_refresh Through

In `functions/searchPublicRecords.ts`, update `searchRecordsByState` to accept and use `force_refresh`:

```js
async function searchRecordsByState(address, state, base44, forceRefresh = false) {
  const normalized = normalizeAddress(address, state);

  if (!forceRefresh) {
    // Check cache (existing cache logic)
    const cached = await base44.entities.PropertyPublicRecord.filter({
      property_address_normalized: normalized
    });
    if (cached.length > 0) {
      const record = cached[0];
      const daysSinceSearch = (new Date() - new Date(record.searched_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceSearch < 30 && (record.search_status === 'found' || record.search_status === 'partial')) {
        return { ...record, from_cache: true };
      }
    }
  }

  // ... rest of the function unchanged ...
}
```

And update both callers in the main handler to pass the flag:
```js
const record = await searchRecordsByState(address, state, base44, force_refresh);
```

---

### Fix 36: Delete Dead Wizard Components

Delete these unused files (they are never imported anywhere):
- `src/components/wizard/StepAIPlatform.jsx`
- `src/components/wizard/StepAssessmentType.jsx`
- `src/components/wizard/StepClientRelationship.jsx`
- `src/components/wizard/StepPropertyDetails.jsx`
- `src/components/wizard/StepOutputFormat.jsx`
- `src/components/wizard/StepConfirmLaunch.jsx`
- `src/components/wizard/StepAnalysisAddOns.jsx`

---

### Fix 37: Remove Duplicate Dependencies

In `package.json`:

1. Remove `moment` — migrate any `moment` usage to `date-fns`. Search for `import moment` across the codebase and replace:
   - `moment(date).format("MM/DD/YYYY")` → `format(new Date(date), "MM/dd/yyyy")` (from date-fns)
   - `moment(date).fromNow()` → `formatDistanceToNow(new Date(date), { addSuffix: true })` (from date-fns)

2. Remove `react-hot-toast` — standardize on `sonner`. Search for `import toast from "react-hot-toast"` and replace with sonner's toast.

3. Remove `next-themes` — it's a Next.js package and not used in this Vite app.

---

### Fix 38: DriveConnectedApp.jsx — Fix Popup Polling

In `src/components/DriveConnectedApp.jsx`, around lines 47-53, add a max timeout and null check:

```js
const popup = window.open(authUrl, "google_drive_auth", "width=600,height=700");
if (!popup) {
  alert("Popup was blocked. Please allow popups for this site and try again.");
  setConnecting(false);
  return;
}
const maxWait = Date.now() + 5 * 60 * 1000; // 5 minutes max
const pollTimer = setInterval(() => {
  if (popup.closed || Date.now() > maxWait) {
    clearInterval(pollTimer);
    if (Date.now() > maxWait && !popup.closed) popup.close();
    setConnecting(false);
    loadConnection(); // Refresh connection status
  }
}, 1000);
```

---

### Fix 39: signFairHousingReview.ts — Remove IP from Console Log

In `functions/signFairHousingReview.ts`, line 77:

BEFORE:
```js
console.log(`[signFairHousingReview] signed by ${user.email}, reviewId=${reviewId}, hash=${contentHash}`);
```

AFTER:
```js
console.log(`[signFairHousingReview] signed by ${user.email}, reviewId=${reviewId}`);
```

The content hash and IP address are already stored in the PrivacyLog entity.
```

---

## BATCH 4: LOW SEVERITY FIXES

```
Fix the following low-severity issues in the PropPrompt app:

---

### Fix 40: generateDocuments.ts — Fix Undefined Variable

In `functions/generateDocuments.ts`, line 213 in the `generatePdf` function:

BEFORE:
```js
const address = analysis.intake_data?.address || analysisId;
```

AFTER:
```js
const address = analysis.intake_data?.address || analysis.id;
```

(`analysisId` is not in scope inside `generatePdf` — use `analysis.id` instead)

---

### Fix 41: Members.jsx — Remove Unused Import

In `src/pages/Members.jsx`, line 3, remove the unused `MoreHorizontal` import:

BEFORE:
```js
import { UserPlus, Search, MoreHorizontal } from "lucide-react";
```

AFTER:
```js
import { UserPlus, Search } from "lucide-react";
```

---

### Fix 42: TerritoryMap.jsx — Add Map Cleanup

In `src/components/territories/TerritoryMap.jsx`, add cleanup to the map creation useEffect:

```js
useEffect(() => {
  const map = new mapboxgl.Map({ ... });
  mapRef.current = map;
  // ... existing setup code ...

  return () => {
    map.remove(); // Clean up WebGL context
  };
}, []);
```

---

### Fix 43: base44Client.js — Fix Misleading Comment

In `src/api/base44Client.js`:

BEFORE:
```js
//Create a client with authentication required
export const base44 = createClient({
  // ...
  requiresAuth: false,
});
```

AFTER:
```js
// Create a Base44 client (auth handled by token when available)
export const base44 = createClient({
  // ...
  requiresAuth: false,
});
```

---

### Fix 44: confirmTopup.ts — Include pool_id

In `functions/confirmTopup.ts`, include `pool_id` in the TopupPack creation:

Add `pool_id` to the create call alongside the other fields:
```js
await base44.asServiceRole.entities.TopupPack.create({
  // ... existing fields ...
  pool_id: pool_id || null,
});
```
```
