import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// AES-256-GCM encrypt/decrypt using ENCRYPTION_KEY env var
async function getKey() {
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("ENCRYPTION_KEY environment variable is required");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(text) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

async function decryptText(encrypted) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// Resolve prompt text from a record — handles FILE: and legacy ENC: prefixes
async function resolvePromptText(base44, rawText) {
  let text = rawText || "";
  try {
    if (text.startsWith("FILE:")) {
      const fileUri = text.slice(5);
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 120 });
      const res = await fetch(signed_url);
      text = await res.text();
    }
    if (text.startsWith("ENC:")) {
      text = await decryptText(text.slice(4));
    }
  } catch (e) {
    console.error("resolvePromptText error:", e.message);
  }
  return text;
}

// Upload encrypted prompt as a private file to avoid entity field size limits
async function uploadPromptAsFile(base44, plainText) {
  const encrypted = "ENC:" + await encryptText(plainText);
  const bytes = new TextEncoder().encode(encrypted);
  const file = new File([bytes], "prompt.enc", { type: "text/plain" });
  const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: file });
  return "FILE:" + file_uri;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "platform_owner") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action, id, data } = body;

    if (action === "list") {
      const prompts = await base44.asServiceRole.entities.PromptLibrary.list('-created_date', 200);
      const decrypted = await Promise.all(prompts.map(async (p) => {
        const prompt_text = await resolvePromptText(base44, p.prompt_text);
        return { ...p, prompt_text };
      }));
      return Response.json({ prompts: decrypted });
    }

    if (action === "save") {
      const { prompt_text, ...rest } = data;
      // Store prompt as private encrypted file to bypass entity field size limits
      const storedRef = await uploadPromptAsFile(base44, prompt_text);
      if (id) {
        const updated = await base44.asServiceRole.entities.PromptLibrary.update(id, { ...rest, prompt_text: storedRef, last_updated_by: user.email });
        return Response.json({ prompt: updated });
      } else {
        const created = await base44.asServiceRole.entities.PromptLibrary.create({ ...rest, prompt_text: storedRef, last_updated_by: user.email });
        return Response.json({ prompt: created });
      }
    }

    if (action === "delete") {
      await base44.asServiceRole.entities.PromptLibrary.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("platformAdminPrompts error:", error);
    console.error("Error data:", JSON.stringify(error?.data));
    return Response.json({ error: error.message }, { status: 500 });
  }
});