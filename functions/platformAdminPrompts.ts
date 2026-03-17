import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-GCM encrypt/decrypt using ENCRYPTION_KEY env var
async function getKey() {
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("ENCRYPTION_KEY environment variable is required");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

async function encryptText(text) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptText(encrypted) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
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
      const prompts = await base44.asServiceRole.entities.PromptLibrary.list();
      const decrypted = await Promise.all(prompts.map(async (p) => {
        let prompt_text = p.prompt_text;
        try {
          if (prompt_text && prompt_text.startsWith("ENC:")) {
            prompt_text = await decryptText(prompt_text.slice(4));
          }
        } catch (_) {}
        return { ...p, prompt_text };
      }));
      return Response.json({ prompts: decrypted });
    }

    if (action === "save") {
      const { prompt_text, ...rest } = data;
      const encrypted = "ENC:" + await encryptText(prompt_text);
      if (id) {
        const updated = await base44.asServiceRole.entities.PromptLibrary.update(id, { ...rest, prompt_text: encrypted, last_updated_by: user.email });
        return Response.json({ prompt: updated });
      } else {
        const created = await base44.asServiceRole.entities.PromptLibrary.create({ ...rest, prompt_text: encrypted, last_updated_by: user.email });
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});