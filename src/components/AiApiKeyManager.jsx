import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { KeyRound, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const AI_PLATFORMS = [
  { key: "chatgpt", label: "ChatGPT (OpenAI)", placeholder: "sk-..." },
];

export default function AiApiKeyManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState({}); // platform -> { value, saved, show, loading }
  const [existingKeys, setExistingKeys] = useState({});

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.AiApiKey.filter({ user_email: user.email }).then((records) => {
      const map = {};
      records.forEach((r) => { map[r.ai_platform] = r; });
      setExistingKeys(map);
    });
  }, [user?.email]);

  function getState(platform) {
    return keys[platform] || { value: "", show: false, loading: false };
  }

  function setState(platform, patch) {
    setKeys((prev) => ({ ...prev, [platform]: { ...getState(platform), ...patch } }));
  }

  async function handleSave(platform) {
    const val = getState(platform).value.trim();
    if (!val) return;
    setState(platform, { loading: true });
    try {
      const existing = existingKeys[platform];
      if (existing) {
        await base44.entities.AiApiKey.update(existing.id, { encrypted_key: val, is_active: true });
      } else {
        await base44.entities.AiApiKey.create({
          user_email: user.email,
          ai_platform: platform,
          encrypted_key: val,
          is_active: true,
        });
      }
      setExistingKeys((prev) => ({ ...prev, [platform]: { ...prev[platform], ai_platform: platform } }));
      setState(platform, { loading: false, value: "", saved: true });
      toast({ title: "API key saved", description: `Your ${platform} key has been saved.` });
      setTimeout(() => setState(platform, { saved: false }), 3000);
    } catch (e) {
      setState(platform, { loading: false });
      toast({ title: "Error saving key", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {AI_PLATFORMS.map(({ key, label, placeholder }) => {
        const state = getState(key);
        const hasExisting = !!existingKeys[key];
        return (
          <div key={key} className="border border-[#1A3226]/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#B8982F]" />
              <span className="text-sm font-medium text-[#1A3226]">{label}</span>
              {hasExisting && (
                <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Key saved</span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={state.show ? "text" : "password"}
                  placeholder={hasExisting ? "Enter new key to replace saved key" : placeholder}
                  value={state.value}
                  onChange={(e) => setState(key, { value: e.target.value })}
                  className="pr-10 text-sm font-mono"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]"
                  onClick={() => setState(key, { show: !state.show })}
                >
                  {state.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={() => handleSave(key)}
                disabled={!state.value.trim() || state.loading}
                className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white shrink-0"
              >
                {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : state.saved ? <Check className="w-4 h-4" /> : "Save"}
              </Button>
            </div>
            <p className="text-xs text-[#1A3226]/40">
              Your key is stored securely and used only when you run analyses via ChatGPT.
            </p>
          </div>
        );
      })}
    </div>
  );
}