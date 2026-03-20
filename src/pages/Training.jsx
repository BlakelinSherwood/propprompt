import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { CheckCircle, Lock, Play, BookOpen } from 'lucide-react';

const CATEGORIES = [
  { id: 'getting_started', label: 'Getting Started', description: 'Start here to get up and running with PropPrompt.' },
  { id: 'cma', label: 'Running a CMA', description: 'Master comparative market analysis with AI assistance.' },
  { id: 'market_reports', label: 'Market Reports', description: 'Generate and share branded market reports with clients.' },
  { id: 'presentations', label: 'Buyer & Seller Presentations', description: 'Create compelling presentations for your clients.' },
  { id: 'territory', label: 'Managing Your Territory', description: 'Maximize your exclusive territory subscription.' },
  { id: 'advanced', label: 'Advanced Techniques', description: 'Power user strategies for top producers.' },
];

const TIER_RANK = { starter: 0, pro: 1, team: 2 };

function formatDuration(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function Training() {
  const [modules, setModules] = useState([]);
  const [videos, setVideos] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('getting_started');
  const [userTier, setUserTier] = useState('starter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [me, mods, vids] = await Promise.all([
        base44.auth.me(),
        base44.entities.TrainingModule.filter({ is_published: true }, 'sort_order', 100),
        base44.entities.TrainingVideo.filter({ is_published: true }, 'sort_order', 200),
      ]);

      try {
        const subs = await base44.entities.TerritorySubscription.filter({ user_id: me.id, status: 'active' });
        const bundles = await base44.entities.TerritoryBundle.filter({ user_id: me.id, status: 'active' });
        const allTiers = [...(subs || []).map(s => s.tier), ...(bundles || []).map(b => b.tier)].filter(Boolean);
        if (allTiers.length) {
          const best = allTiers.reduce((a, b) => TIER_RANK[a] >= TIER_RANK[b] ? a : b);
          setUserTier(best);
        }
      } catch {}

      try {
        const prog = await base44.entities.TrainingProgress.filter({});
        const userProgress = (prog || []).filter(p => p.user_id === me.id && p.completed_at);
        setCompletedIds(new Set(userProgress.map(p => p.video_id)));
      } catch {}

      setModules(mods);
      setVideos(vids);
      setLoading(false);
    }
    load();
  }, []);

  function getCategoryStats(catId) {
    const catMods = modules.filter(m => m.category === catId);
    const catVids = catMods.flatMap(m => videos.filter(v => v.module_id === m.id));
    return { total: catVids.length, completed: catVids.filter(v => completedIds.has(v.id)).length };
  }

  function isLocked(video) {
    if (!video.requires_tier) return false;
    return TIER_RANK[userTier] < TIER_RANK[video.requires_tier];
  }

  const categoryInfo = CATEGORIES.find(c => c.id === selectedCategory);
  const categoryModules = modules.filter(m => m.category === selectedCategory);
  const categoryVideos = categoryModules.flatMap(m => videos.filter(v => v.module_id === m.id));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden lg:block w-60 flex-shrink-0">
        <div className="sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#1A3226]" />
            <h2 className="font-semibold text-[#1A3226]">Training Library</h2>
          </div>
          <nav className="space-y-1">
            {CATEGORIES.map(cat => {
              const stats = getCategoryStats(cat.id);
              const active = selectedCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${active ? 'bg-[#1A3226] text-white' : 'text-[#1A3226]/70 hover:bg-[#1A3226]/5 hover:text-[#1A3226]'}`}
                >
                  <div className="text-sm font-medium">{cat.label}</div>
                  {stats.total > 0 && (
                    <div className={`text-xs mt-0.5 ${active ? 'text-white/70' : 'text-[#1A3226]/40'}`}>
                      {stats.completed} of {stats.total} complete
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile category picker */}
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
          className="lg:hidden w-full mb-4 border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm text-[#1A3226]">
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A3226]">{categoryInfo?.label}</h1>
          <p className="text-[#1A3226]/60 mt-1 text-sm">{categoryInfo?.description}</p>
        </div>

        {categoryVideos.length === 0 ? (
          <div className="text-center py-16 text-[#1A3226]/40">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No videos available in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {categoryVideos.map(video => {
              const locked = isLocked(video);
              const done = completedIds.has(video.id);
              return (
                <Link key={video.id} to={locked ? '#' : `/training/${video.id}`}
                  onClick={locked ? e => e.preventDefault() : undefined}
                  className={`group rounded-xl border overflow-hidden transition-all ${locked ? 'border-[#1A3226]/10 opacity-60 cursor-not-allowed' : 'border-[#1A3226]/10 hover:border-[#B8982F]/40 hover:shadow-md'}`}>
                  <div className="relative aspect-video bg-[#1A3226]/5">
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-10 h-10 text-[#1A3226]/20" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {locked
                        ? <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"><Lock className="w-5 h-5 text-white" /></div>
                        : <div className="w-10 h-10 rounded-full bg-[#1A3226]/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-5 h-5 text-white ml-0.5" /></div>
                      }
                    </div>
                    {video.duration_seconds && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                    {done && <div className="absolute top-2 right-2"><CheckCircle className="w-5 h-5 text-green-400 drop-shadow" /></div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#1A3226] leading-tight">{video.title}</h3>
                      {locked && (
                        <span className="text-xs bg-[#B8982F]/10 text-[#B8982F] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          {video.requires_tier === 'team' ? 'Team' : 'Pro+'}
                        </span>
                      )}
                    </div>
                    {video.description && <p className="text-xs text-[#1A3226]/50 mt-1 line-clamp-2">{video.description}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}