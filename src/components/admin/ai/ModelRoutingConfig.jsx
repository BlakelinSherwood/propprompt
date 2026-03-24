import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, AlertCircle } from 'lucide-react';

const SECTIONS = [
  'market_context',
  'comps',
  'valuation',
  'avm_analysis',
  'migration',
  'archetypes',
  'language_calibration',
  'portfolio_options',
  'adu_analysis',
  'rate_environment',
];

const MODEL_OPTIONS = [
  { value: 'anthropic::claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Strongest)' },
  { value: 'anthropic::claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'openai::gpt-4o', label: 'GPT-4O' },
  { value: 'google::gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'anthropic::claude-haiku-4-5', label: 'Claude Haiku (Fastest)' },
];

export default function ModelRoutingConfig() {
  const [routingConfig, setRoutingConfig] = useState(null);
  const [localConfig, setLocalConfig] = useState({});
  const [splitRoutingEnabled, setSplitRoutingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // This would load from a platform config entity if implemented
      // For now, we initialize empty
      const config = {};
      SECTIONS.forEach(section => {
        config[section] = { enabled: false, model: null };
      });
      setLocalConfig(config);
    } catch (e) {
      console.error('[ModelRoutingConfig] load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      // Save routing config to platform settings
      // This is a placeholder — would integrate with actual platform config entity
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated save
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.values(localConfig).some(s => s.enabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-[#1A3226]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BLOCK 1: Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>Split Routing Infrastructure:</strong> This page configures per-section model overrides. Changes here will NOT affect the pipeline until you enable split routing from the Ensemble tab. Use this to prepare routing strategies based on quality audit data.
        </div>
      </div>

      {/* BLOCK 2: Master Toggle */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1A3226]">Enable Split Routing</h3>
            <p className="text-sm text-[#1A3226]/60 mt-1">When enabled, each report section uses its configured model instead of the global ensemble model.</p>
          </div>
          <Switch
            checked={splitRoutingEnabled}
            onCheckedChange={setSplitRoutingEnabled}
          />
        </div>
      </div>

      {/* BLOCK 3: Section Configuration */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg overflow-hidden">
        <div className="bg-[#1A3226]/[0.03] px-6 py-4 border-b border-[#1A3226]/10">
          <h3 className="text-sm font-semibold text-[#1A3226]">Section-Level Model Overrides</h3>
          <p className="text-xs text-[#1A3226]/60 mt-1">Configure which model should generate each section. Leave disabled to use the global ensemble model.</p>
        </div>

        <div className="divide-y divide-[#1A3226]/8">
          {SECTIONS.map(section => (
            <div key={section} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#1A3226]/[0.02] transition-colors">
              {/* LEFT: Section name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1A3226] capitalize">
                  {section.replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-[#1A3226]/50 mt-0.5">
                  Currently using global model
                </div>
              </div>

              {/* MIDDLE: Override toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={localConfig[section]?.enabled || false}
                  onCheckedChange={(enabled) => {
                    setLocalConfig(prev => ({
                      ...prev,
                      [section]: { ...prev[section], enabled }
                    }));
                  }}
                />
              </div>

              {/* RIGHT: Model selector (visible when enabled) */}
              {localConfig[section]?.enabled && (
                <div className="w-48">
                  <select
                    value={localConfig[section]?.model || ''}
                    onChange={(e) => {
                      setLocalConfig(prev => ({
                        ...prev,
                        [section]: { ...prev[section], model: e.target.value }
                      }));
                    }}
                    className="w-full text-xs border border-[#1A3226]/15 rounded-lg px-2.5 py-1.5 bg-white text-[#1A3226] focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  >
                    <option value="">Select model…</option>
                    {MODEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BLOCK 4: Analysis Type Presets */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Recommended Presets (Based on Audit Data)</h3>
        <p className="text-xs text-[#1A3226]/60 mb-4">
          These are template configurations based on typical quality audit patterns. Apply one and customize as needed.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => {
              // Upgrade narrative sections (migration, archetypes, language) only
              const newConfig = { ...localConfig };
              ['migration', 'archetypes', 'language_calibration'].forEach(s => {
                newConfig[s] = { enabled: true, model: 'anthropic::claude-sonnet-4-20250514' };
              });
              setLocalConfig(newConfig);
            }}
            className="text-left p-4 border border-[#1A3226]/15 rounded-lg hover:bg-[#1A3226]/[0.02] transition-colors"
          >
            <div className="font-medium text-sm text-[#1A3226]">Strengthen Narrative Sections</div>
            <div className="text-xs text-[#1A3226]/60 mt-1">
              Upgrade migration, archetypes, language calibration. Keep structured sections (comps, valuation) on baseline.
            </div>
          </button>

          <button
            onClick={() => {
              // Upgrade comps & valuation only
              const newConfig = { ...localConfig };
              ['comps', 'valuation'].forEach(s => {
                newConfig[s] = { enabled: true, model: 'anthropic::claude-sonnet-4-20250514' };
              });
              setLocalConfig(newConfig);
            }}
            className="text-left p-4 border border-[#1A3226]/15 rounded-lg hover:bg-[#1A3226]/[0.02] transition-colors"
          >
            <div className="font-medium text-sm text-[#1A3226]">Strengthen Valuation Analysis</div>
            <div className="text-xs text-[#1A3226]/60 mt-1">
              Upgrade comps and valuation. Keeps lighter sections (market context, AVM) on baseline.
            </div>
          </button>

          <button
            onClick={() => {
              // Downgrade everything to Haiku
              const newConfig = { ...localConfig };
              SECTIONS.forEach(s => {
                newConfig[s] = { enabled: true, model: 'anthropic::claude-haiku-4-5' };
              });
              setLocalConfig(newConfig);
            }}
            className="text-left p-4 border border-[#1A3226]/15 rounded-lg hover:bg-[#1A3226]/[0.02] transition-colors"
          >
            <div className="font-medium text-sm text-[#1A3226]">Cost Optimization (Experimental)</div>
            <div className="text-xs text-[#1A3226]/60 mt-1">
              Run all sections on Haiku. Use only if audit data shows consistent high scores across the board.
            </div>
          </button>
        </div>
      </div>

      {/* BLOCK 5: Save */}
      {hasChanges && (
        <div className="bg-white border border-[#B8982F]/30 rounded-lg p-4 flex items-start gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-[#1A3226]">Unsaved Configuration</div>
            <p className="text-xs text-[#1A3226]/60 mt-1">
              {Object.values(localConfig).filter(s => s.enabled).length} section(s) configured. Changes apply only after save.
            </p>
          </div>
          <Button
            onClick={saveConfig}
            disabled={saving}
            className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </Button>
          {saved && (
            <div className="text-green-600 text-sm font-medium">✓ Saved</div>
          )}
        </div>
      )}
    </div>
  );
}