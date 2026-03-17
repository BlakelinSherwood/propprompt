# PropPrompt Application Audit Report

**Date:** 2026-03-17
**Scope:** Full-stack audit of frontend (React/Vite) and backend (Deno serverless functions)
**Auditor:** Automated code audit

---

## Executive Summary

The PropPrompt codebase is a sophisticated real-estate SaaS application with multi-tenant architecture, AI streaming integrations, Stripe billing, and document generation. The audit identified **42 findings** across security, correctness, performance, and code quality categories.

| Severity | Count |
|----------|-------|
| Critical | 5     |
| High     | 12    |
| Medium   | 15    |
| Low      | 10    |

---

## Critical Findings

### C1. Hardcoded Default Encryption Key (Security)
**Files:** `functions/assemblePrompt.ts:16`, `functions/resolveApiKey.ts:13`
**Issue:** The encryption key fallback `"default-key-32-bytes-padded-here!!"` is hardcoded. If the `ENCRYPTION_KEY` environment variable is unset, all encrypted API keys and prompts are protected by a publicly visible key.
**Impact:** Any attacker who reads the source code can decrypt all stored API keys and prompt templates.
**Fix:** Remove the fallback entirely. If `ENCRYPTION_KEY` is missing, throw an error and refuse to start.

### C2. Inconsistent Encryption Schemes Across Functions (Security)
**Files:** `functions/resolveApiKey.ts:23-31` vs `functions/openaiStream.ts:3-16`
**Issue:** Two different decryption implementations exist:
- `resolveApiKey.ts` uses AES-GCM with iv prepended (no separator)
- `openaiStream.ts` uses AES-GCM with `iv:ciphertext` colon separator
This means data encrypted by one function cannot be decrypted by the other, leading to silent failures.
**Fix:** Consolidate to a single shared encryption/decryption utility.

### C3. OAuth Token Stored in Plaintext (Security)
**File:** `functions/driveOauthCallback.ts:53-54`
**Issue:** Google OAuth `access_token` and `refresh_token` are stored in plaintext in the `DriveConnection` entity. These tokens grant access to users' Google Drive files.
**Fix:** Encrypt tokens at rest using the same AES-GCM encryption used for API keys.

### C4. `searchPublicRecords` Creates Client Without Request Context (Bug)
**File:** `functions/searchPublicRecords.ts:124`
**Issue:** `invokeAISearch()` calls `createClientFromRequest({})` with an empty object instead of the actual request. This creates an unauthenticated client that will fail or bypass auth checks.
**Fix:** Pass the actual request object or the authenticated `base44` client instance through to `invokeAISearch`.

### C5. `approveClaim` Auth Bypass on Catch (Security)
**File:** `functions/approveClaim.ts:50-56`
**Issue:** If `base44.auth.me()` throws (e.g., network error, malformed token), the catch block sets `isAdmin = true`, granting admin access to anyone. This is a critical authentication bypass.
**Fix:** Set `isAdmin = false` in the catch block, not `true`.

---

## High Severity Findings

### H1. Duplicate Route Declaration (Bug)
**File:** `src/App.jsx:81`
**Issue:** The route `/team/:id/branding` is declared twice (lines 80 and 81). The second route will never be reached.
**Fix:** Remove the duplicate line 81.

### H2. No Analysis Quota Check Before Running Analysis (Business Logic)
**File:** `src/pages/NewAnalysis.jsx:68-88`, `src/pages/AnalysisRun.jsx:47-150`
**Issue:** The `handleSubmit` function creates an analysis and immediately navigates to streaming without calling `checkAnalysisQuota`. Users can bypass their monthly analysis cap.
**Fix:** Call `checkAnalysisQuota` before creating the analysis record and block if quota is exhausted.

### H3. SSE Stream Error Response Parsed as JSON Without Check (Bug)
**File:** `src/pages/AnalysisRun.jsx:102-106`
**Issue:** When `response.ok` is false, the code calls `response.json()` but doesn't handle the case where the error response might not be valid JSON (e.g., 502 gateway timeout returns HTML).
**Fix:** Wrap in try/catch: `const err = await response.json().catch(() => ({ error: "Request failed" }))`.

### H4. Missing Error Handling in Multiple Async Handlers (Bug)
**Files:** `src/pages/AnalysisRun.jsx:163-178`
**Issue:** `handleDownloadPdf`, `handleDownloadPptx`, `handleDriveUpload`, `handleSendEmail`, and `handleCrmPush` have no try/catch. If any function invocation fails, the error is unhandled and the UI may get stuck in a loading state (e.g., `pptxGenerating` stays `true` forever).
**Fix:** Wrap each handler in try/catch with appropriate error state and user notification.

### H5. `claudeStream` Does Not Deduct Analysis Quota (Business Logic)
**File:** `functions/claudeStream.ts`
**Issue:** After streaming completes successfully, the analysis status is set to "complete" but `deductAnalysisQuota` is never called. Users get unlimited free analyses.
**Fix:** Call `deductAnalysisQuota` after successful completion (and before marking complete).

### H6. `chatbotMessage` Rate Limiting is Inefficient and Bypassable (Performance/Security)
**File:** `functions/chatbotMessage.ts:94-105`
**Issue:** Rate limiting loads ALL sessions for a user, then iterates ALL messages in ALL sessions to count today's messages. This is O(n*m) where n = sessions and m = messages. For active users this could be thousands of records. Additionally, users can bypass it by not sending `sessionId` (creating a new session each time).
**Fix:** Use a dedicated counter entity or filter sessions by date server-side.

### H7. Stripe Webhook Missing Idempotency Handling (Reliability)
**File:** `functions/stripeWebhook.ts`
**Issue:** Stripe may deliver webhooks multiple times. The handler has no idempotency checks, so duplicate events could add overage packs twice or create duplicate records.
**Fix:** Store processed `event.id` values and skip duplicates.

### H8. XSS in Email HTML Template (Security)
**File:** `functions/generateDocuments.ts:388-432`
**Issue:** The `buildEmailHtml` function interpolates `branding.org_name`, `branding.org_tagline`, `branding.agent_name`, `analysis.output_text`, and `analysis.intake_data.address` directly into HTML without escaping. An attacker who controls branding fields or analysis output could inject malicious scripts into emails.
**Fix:** HTML-escape all interpolated values before insertion.

### H9. `openaiStream` Requires `prompt_assembled` but `claudeStream` Does Not (Inconsistency/Bug)
**Files:** `functions/openaiStream.ts:74-76` vs `functions/claudeStream.ts:43-44`
**Issue:** `openaiStream` checks that `analysis.prompt_assembled` exists and returns 400 if missing. `claudeStream` calls `assemblePrompt` inline and falls back to a generic prompt. This means the same analysis wizard flow works with Claude but may fail with ChatGPT if `assemblePrompt` wasn't called first.
**Fix:** Standardize: either all stream functions call `assemblePrompt` inline, or the wizard calls it before navigating.

### H10. `openaiStream` Tries to Decrypt `prompt_assembled` (Bug)
**File:** `functions/openaiStream.ts:79`
**Issue:** `prompt_assembled` is stored as plaintext (set in `assemblePrompt.ts:119`), but `openaiStream` tries to decrypt it via `decryptData()`. If it's not encrypted, the colon-split decryption will likely return the raw text (by the fallback at line 5), but this is fragile and confusing.
**Fix:** Store assembled prompts consistently (either always encrypted or always plaintext) and handle accordingly.

### H11. Redundant `base44.auth.me()` Calls Per Page Load (Performance)
**Files:** `src/pages/Dashboard.jsx:32`, `src/components/Layout.jsx:41`, `src/pages/Analyses.jsx:33`, `src/pages/Members.jsx:31`, `src/pages/Billing.jsx:58`, `src/pages/NewAnalysis.jsx:44`
**Issue:** Nearly every page independently calls `base44.auth.me()` on mount, despite `AuthContext` already fetching the user. The user object is available via `useAuth()` but is not used.
**Fix:** Use `useAuth().user` instead of making redundant API calls.

### H12. `Access-Control-Allow-Origin: *` on Stream Responses (Security)
**File:** `functions/openaiStream.ts:158,213`
**Issue:** The stream response sets `Access-Control-Allow-Origin: *`, allowing any website to make requests to the streaming endpoint. Combined with the Bearer token in the request, this could enable cross-site request abuse.
**Fix:** Remove the wildcard CORS header; let the platform's CORS configuration handle this.

---

## Medium Severity Findings

### M1. Duplicate Date Libraries (Dependency Bloat)
**File:** `package.json:53,61`
**Issue:** Both `moment` (deprecated, ~300KB) and `date-fns` (~20KB) are included. Only one should be used.
**Fix:** Migrate all `moment` usage to `date-fns` and remove `moment`.

### M2. Duplicate Toast Libraries (Dependency Bloat)
**File:** `package.json:70,74`
**Issue:** Both `react-hot-toast` and `sonner` are included. These serve the same purpose.
**Fix:** Standardize on one toast library.

### M3. `next-themes` in a Vite/React App (Unnecessary Dependency)
**File:** `package.json:62`
**Issue:** `next-themes` is a Next.js-specific package. This is not a Next.js app.
**Fix:** Remove if unused, or replace with a Vite-compatible theme provider.

### M4. Hardcoded Platform Owner Email (Maintenance)
**File:** `src/components/Layout.jsx:22`
**Issue:** `PLATFORM_OWNER_EMAIL = "blake.sherwood@compass.com"` is hardcoded. This creates a maintenance burden and won't scale.
**Fix:** Move to environment configuration or fetch from app settings.

### M5. `ROLE_LABELS` Duplicated Across 4+ Files (Code Quality)
**Files:** `src/pages/Dashboard.jsx:12-19`, `src/pages/Members.jsx:9-16`, `src/components/Layout.jsx:24-31`, `src/pages/AnalysisRun.jsx:12-18`
**Issue:** The same `ROLE_LABELS` and `ASSESSMENT_LABELS` maps are copy-pasted across many files.
**Fix:** Extract into a shared constants file (e.g., `src/lib/constants.js`).

### M6. `ASSESSMENT_LABELS` Duplicated Across Frontend and Backend
**Files:** `src/pages/AnalysisRun.jsx:12-18`, `functions/generateDocuments.ts:323-329`, `functions/sendAnalysisEmail.ts:3-9`
**Issue:** Same constant defined in 3+ places. Changes must be synchronized manually.
**Fix:** Backend functions should share a single constants module.

### M7. No Pagination on Analysis/User Lists (Performance)
**Files:** `src/pages/Dashboard.jsx:44`, `src/pages/Analyses.jsx:37`, `src/pages/Members.jsx:33`
**Issue:** `base44.entities.Analysis.list("-created_date", 200)` and `base44.entities.User.list()` fetch all records at once. As the user base grows, this will cause slow page loads and high memory usage.
**Fix:** Implement pagination with cursor-based loading.

### M8. `signFairHousingReview` Logs `contentHash` and `ipAddress` to Console (Privacy)
**File:** `functions/signFairHousingReview.ts:77`
**Issue:** IP addresses are logged to console output, which may be stored in logging infrastructure. This could violate privacy regulations.
**Fix:** Remove IP address from console logs; it's already stored in the PrivacyLog entity.

### M9. Missing `useEffect` Cleanup for SSE Stream Reader (Memory Leak)
**File:** `src/pages/AnalysisRun.jsx:47-150`
**Issue:** The SSE stream reader in the `useEffect` has no cleanup function. If the component unmounts while streaming (e.g., user navigates away), the stream continues reading in the background, causing a memory leak and potential state-update-on-unmounted-component error.
**Fix:** Return a cleanup function that calls `reader.cancel()` and uses an `AbortController` for the fetch.

### M10. `Billing.jsx` Displays Hardcoded Prices Instead of Dynamic Pricing (Consistency)
**File:** `src/pages/Billing.jsx:8-41`
**Issue:** Plan prices are hardcoded ($199, $99, $49, etc.) instead of fetched from the `PricingConfig` entity. If admin changes pricing, the billing page shows stale data.
**Fix:** Fetch pricing from `PricingConfig` or the `getPricingConfig` function.

### M11. `checkAnalysisQuota` Fetches All TopupPacks Without User Filter (Performance)
**File:** `functions/checkAnalysisQuota.ts:28`
**Issue:** `TopupPack.list('expires_at', 200)` fetches up to 200 topup packs globally (not filtered by user), then filters client-side. This is inefficient and could return other users' packs.
**Fix:** Add a server-side filter for the user's subscription IDs.

### M12. Unused Variable `state` in `approveClaim.ts` (Code Quality)
**File:** `functions/approveClaim.ts:81`
**Issue:** Variable `state` is declared but never used.
**Fix:** Remove the unused variable.

### M13. `newStatus` Always Set to `'active'` Regardless of Condition (Logic Bug)
**File:** `functions/approveClaim.ts:154`
**Issue:** `const newStatus = allClaimed >= (territory?.seats_total || 1) ? 'active' : 'active';` — both branches return `'active'`, making the ternary meaningless. It likely should set `'full'` or `'sold_out'` when all seats are claimed.
**Fix:** Set the correct status when all seats are claimed.

### M14. `force_refresh` Parameter in `searchPublicRecords` Doesn't Fully Work (Bug)
**File:** `functions/searchPublicRecords.ts:183-185`
**Issue:** When `force_refresh` is true, it still calls `searchRecordsByState` which checks the cache internally (lines 16-25). The cache check inside `searchRecordsByState` doesn't know about `force_refresh`.
**Fix:** Pass `force_refresh` flag through to `searchRecordsByState` and skip cache when true.

### M15. Email Dialog Lacks Validation (UX)
**File:** `src/pages/AnalysisRun.jsx:377-383`
**Issue:** The email input only checks `!emailTo` but doesn't validate email format. Users could send to invalid addresses.
**Fix:** Add basic email regex validation.

---

## Low Severity Findings

### L1. `three.js` (~600KB) May Be Unused or Underused
**File:** `package.json:77`
**Issue:** Three.js is a large 3D graphics library. Verify it's actually used; if only for a minor visual effect, consider removing it.

### L2. Inconsistent Route Casing
**File:** `src/App.jsx:66-97`
**Issue:** Routes mix PascalCase (`/Dashboard`, `/NewAnalysis`) with lowercase (`/training`, `/territories`, `/claim`). This is inconsistent and could confuse developers.
**Fix:** Standardize to lowercase kebab-case for all routes.

### L3. `window.location.search` Used Instead of React Router
**File:** `src/pages/AnalysisRun.jsx:22-24`
**Issue:** Uses `new URLSearchParams(window.location.search)` instead of React Router's `useSearchParams()` hook. This won't react to navigation changes.
**Fix:** Use `useSearchParams()` from `react-router-dom`.

### L4. `onClose={() => {}}` Noop Handler
**File:** `src/pages/Dashboard.jsx:94`
**Issue:** `<OnboardingWelcomeModal onClose={() => {}} />` has an empty close handler. This likely means the modal can't be dismissed.
**Fix:** Implement proper close behavior.

### L5. Silent JSON Parse Failures in Stream Processing
**Files:** `src/pages/AnalysisRun.jsx:140`, `functions/claudeStream.ts:107`
**Issue:** `catch (_) {}` silently swallows JSON parse errors during streaming. While some non-JSON lines are expected in SSE, this also hides genuine parsing bugs.
**Fix:** Log unexpected parse failures at debug level.

### L6. `MoreHorizontal` Icon Imported but Unused
**File:** `src/pages/Members.jsx:3`
**Issue:** `MoreHorizontal` is imported from lucide-react but never used.
**Fix:** Remove unused import.

### L7. Fair Housing Compliance Card is Not Clickable
**File:** `src/pages/Dashboard.jsx:172-174`
**Issue:** The Fair Housing Compliance card has `onClick={() => {}}` — it looks clickable but does nothing.
**Fix:** Either navigate to a compliance page or remove the clickable styling.

### L8. No Loading State After Form Submission in `NewAnalysis`
**File:** `src/pages/NewAnalysis.jsx:68-89`
**Issue:** `setSubmitting(true)` is called but there's no error handling — if `Analysis.create` fails, `submitting` stays true forever and the user can't retry.
**Fix:** Add try/catch and reset `submitting` on error.

### L9. `undefined` Variable Reference in PDF Generation
**File:** `functions/generateDocuments.ts:213`
**Issue:** `const address = analysis.intake_data?.address || analysisId;` — `analysisId` is not in scope of the `generatePdf` function (it's a parameter of the outer handler). This will throw a ReferenceError.
**Fix:** Pass `analysisId` as a parameter to `generatePdf`, or use `analysis.id`.

### L10. Stripe Price IDs Hardcoded in Multiple Files
**Files:** `functions/stripeWebhook.ts:16-28`, `functions/stripeCheckout.ts:18-22`, `src/pages/Billing.jsx:13-41`
**Issue:** Stripe price IDs are hardcoded in 3 separate files. If prices change, all three must be updated.
**Fix:** Store price IDs in environment variables or a configuration entity.

---

## Recommendations Summary

### Immediate Actions (Critical + High)
1. Remove hardcoded encryption key fallback
2. Fix auth bypass in `approveClaim.ts` catch block
3. Consolidate encryption/decryption to single utility
4. Encrypt OAuth tokens at rest
5. Fix `searchPublicRecords` empty request context
6. Add quota check before analysis creation
7. Add quota deduction after analysis completion
8. Add try/catch to all async UI handlers
9. Fix duplicate route in App.jsx
10. Add Stripe webhook idempotency

### Short-Term Improvements (Medium)
1. Use `useAuth()` context instead of redundant `auth.me()` calls
2. Extract shared constants (ROLE_LABELS, ASSESSMENT_LABELS)
3. Remove duplicate dependencies (moment, react-hot-toast)
4. HTML-escape email template interpolations
5. Add pagination to list queries
6. Fix `approveClaim` status ternary logic
7. Add SSE stream cleanup on unmount

### Long-Term Improvements (Low)
1. Standardize route casing
2. Audit Three.js usage
3. Move Stripe price IDs to configuration
4. Add email validation
5. Implement proper error boundaries
