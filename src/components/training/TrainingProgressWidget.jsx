import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Play, GraduationCap } from 'lucide-react';

function formatDuration(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function TrainingProgressWidget({ user }) {
  const [videos, setVideos] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    async function load() {
      try {
        const [vids, prog] = await Promise.all([
          base44.entities.TrainingVideo.filter({ is_published: true }, 'sort_order', 200),
          base44.entities.TrainingProgress.filter({ user_email: user.email }),
        ]);
        setVideos(vids);
        setCompletedIds(new Set(prog.filter(p => p.is_completed).map(p => p.video_id)));
      } catch {}
      setLoading(false);
    }
    load();
  }, [user?.email]);

  if (loading || videos.length === 0) return null;

  const total = videos.length;
  const completed = completedIds.size;
  const pct = Math.round((completed / total) * 100);
  const nextVideo = videos.find(v => !completedIds.has(v.id));

  return (
    <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#B8982F]" />
          <h2 className="font-semibold text-[#1A3226]">Training Progress</h2>
        </div>
        <Link to="/training" className="text-xs text-[#B8982F] hover:underline font-medium">
          Continue Training →
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-[#1A3226]">{completed}</span>
        <span className="text-sm text-[#1A3226]/40">of {total} videos complete</span>
      </div>

      <div className="w-full bg-[#1A3226]/10 rounded-full h-2 mb-4">
        <div className="bg-[#B8982F] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {nextVideo && (
        <Link to={`/training/${nextVideo.id}`}
          className="flex items-center gap-3 p-3 rounded-lg border border-[#1A3226]/10 hover:border-[#B8982F]/40 hover:bg-[#B8982F]/5 transition-all group">
          <div className="w-10 h-8 bg-[#1A3226]/5 rounded flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-[#1A3226]/40 group-hover:text-[#B8982F] transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#1A3226] truncate">{nextVideo.title}</p>
            {nextVideo.duration_seconds && <p className="text-xs text-[#1A3226]/40">{formatDuration(nextVideo.duration_seconds)}</p>}
          </div>
        </Link>
      )}
    </div>
  );
}