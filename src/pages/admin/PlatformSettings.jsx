import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Tag, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function PlatformSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [versionInput, setVersionInput] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [runningPL, setRunningPL] = useState(false);

  async function runPLSnapshot() {
    setRunningPL(true);
    try {
      const res = await base44.functions.invoke('generateWeeklyPLSnapshot', {});
      const d = res.data;
      if (d?.skipped) {
        toast({ title: 'Already exists', description: d.message });
      } else {
        toast({ title: 'P/L snapshot created', description: `Week of ${d?.week} — Net: ${d?.summary?.net_pl ?? 'see record'}` });
      }
    } catch (e) {
      toast({ title: 'Snapshot error', description: e.message, variant: 'destructive' });
    } finally {
      setRunningPL(false);
    }
  }

  async function runFlipbookCleanup() {
    setRunningCleanup(true);
    try {
      const res = await base44.functions.invoke('cleanupExpiredFlipbooks', {});
      toast({ title: 'Cleanup complete', description: res.data?.summary || 'Done.' });
    } catch (e) {
      toast({ title: 'Cleanup error', description: e.message, variant: 'destructive' });
    } finally {
      setRunningCleanup(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
      setPlatformConfig(configs[0] || {});
    } catch (err) {
      console.error(err);
      setPlatformConfig({});
    } finally {
      setLoading(false);
    }
  }

  async function saveVersion() {
    const v = versionInput.trim();
    if (!v) return;
    setSavingVersion(true);
    try {
      if (platformConfig?.id) {
        await base44.asServiceRole.entities.PlatformConfig.update(platformConfig.id, { platform_version: v });
        setPlatformConfig(prev => ({ ...prev, platform_version: v }));
      } else {
        const created = await base44.asServiceRole.entities.PlatformConfig.create({ platform_version: v });
        setPlatformConfig(created);
      }
      setVersionInput('');
      toast({ title: `Platform version updated to v${v}` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingVersion(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3226]">Platform Settings</h1>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          General platform configuration.
        </p>
      </div>

      {/* Platform Version */}
      <div className="rounded-2xl border-2 border-[#1A3226]/20 bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <Tag className="w-5 h-5 text-[#1A3226]/50" />
          <h2 className="text-base font-bold text-[#1A3226]">Platform Version</h2>
        </div>
        <p className="text-xs text-[#1A3226]/40 mb-3">
          Current: <span className="font-semibold text-[#1A3226]/70">v{platformConfig?.platform_version || '4.0'}</span> — displayed on prompts and reports.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`e.g. ${platformConfig?.platform_version || '4.0'}`}
            value={versionInput}
            onChange={e => setVersionInput(e.target.value)}
            className="px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B8982F]/30 w-40"
          />
          <Button
            onClick={saveVersion}
            disabled={!versionInput.trim() || savingVersion}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
          >
            {savingVersion ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
          </Button>
        </div>
      </div>

      {/* P/L Snapshot */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-[#1A3226]/[0.02] p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1A3226]">Weekly P/L Snapshot</p>
          <p className="text-xs text-[#1A3226]/50 mt-0.5">Generate last week's P/L record manually. Runs automatically every Monday at 6am.</p>
        </div>
        <Button
          onClick={runPLSnapshot}
          disabled={runningPL}
          variant="outline"
          size="sm"
          className="gap-1.5 border-[#1A3226]/20"
        >
          {runningPL ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
          Run P/L snapshot now
        </Button>
      </div>

      {/* Flipbook Cleanup */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-[#1A3226]/[0.02] p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1A3226]">Flipbook Link Cleanup</p>
          <p className="text-xs text-[#1A3226]/50 mt-0.5">Expire overdue flipbook links and delete associated PDF files. Runs automatically nightly at 3am.</p>
        </div>
        <Button
          onClick={runFlipbookCleanup}
          disabled={runningCleanup}
          variant="outline"
          size="sm"
          className="gap-1.5 border-[#1A3226]/20"
        >
          {runningCleanup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Run flipbook cleanup now
        </Button>
      </div>

      {/* Link to AI Settings */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-[#1A3226]/[0.02] p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1A3226]">AI API Keys & Models</p>
          <p className="text-xs text-[#1A3226]/50 mt-0.5">Manage API keys for Claude, ChatGPT, Gemini, Perplexity, and Grok.</p>
        </div>
        <Link to="/admin/ai-settings">
          <Button variant="outline" size="sm" className="gap-1.5 border-[#1A3226]/20">
            Open <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}