import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, ChevronDown, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatDuration(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function TrainingVideo() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [nextVideo, setNextVideo] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loading, setLoading] = useState(true);
  const progressIdRef = useRef(null);
  const watchSecondsRef = useRef(0);
  const intervalRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    async function load() {
      const [me, allVids] = await Promise.all([
        base44.auth.me(),
        base44.entities.TrainingVideo.filter({ is_published: true }, 'sort_order', 200),
      ]);

      const current = allVids.find(v => v.id === videoId);
      setVideo(current);
      videoRef.current = current;

      if (current) {
        const moduleVids = allVids.filter(v => v.module_id === current.module_id);
        const idx = moduleVids.findIndex(v => v.id === videoId);
        if (idx >= 0 && idx < moduleVids.length - 1) setNextVideo(moduleVids[idx + 1]);

        // Upsert progress record
        try {
          const existing = await base44.entities.TrainingProgress.filter({ user_email: me.email, video_id: videoId });
          if (existing.length) {
            progressIdRef.current = existing[0].id;
            watchSecondsRef.current = existing[0].watch_time_seconds || 0;
            setIsCompleted(existing[0].is_completed || false);
          } else {
            const created = await base44.entities.TrainingProgress.create({
              user_email: me.email,
              video_id: videoId,
              started_at: new Date().toISOString(),
              watch_time_seconds: 0,
              is_completed: false,
            });
            progressIdRef.current = created.id;
          }
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, [videoId]);

  // Watch timer — every 30s, update watch_time_seconds and check 80% threshold
  useEffect(() => {
    if (!progressIdRef.current || isCompleted) return;
    intervalRef.current = setInterval(async () => {
      watchSecondsRef.current += 30;
      if (!progressIdRef.current) return;
      const dur = videoRef.current?.duration_seconds;
      const update = { watch_time_seconds: watchSecondsRef.current };
      if (dur && watchSecondsRef.current >= dur * 0.8) {
        update.is_completed = true;
        update.completed_at = new Date().toISOString();
        setIsCompleted(true);
        clearInterval(intervalRef.current);
      }
      await base44.entities.TrainingProgress.update(progressIdRef.current, update);
    }, 30000);
    return () => clearInterval(intervalRef.current);
  }, [loading, isCompleted]);

  async function markComplete() {
    if (!progressIdRef.current) return;
    await base44.entities.TrainingProgress.update(progressIdRef.current, {
      is_completed: true,
      completed_at: new Date().toISOString(),
    });
    setIsCompleted(true);
    clearInterval(intervalRef.current);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );
  if (!video) return <div className="p-8 text-center text-[#1A3226]/50">Video not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/training" className="inline-flex items-center gap-1.5 text-sm text-[#1A3226]/60 hover:text-[#1A3226] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Training
      </Link>

      {/* Video embed */}
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        {video.heygen_video_id ? (
          <iframe
            src={`https://app.heygen.com/embeds/${video.heygen_video_id}`}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="w-full h-full"
            title={video.title}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <ArrowRight className="w-8 h-8" />
            </div>
            <p className="text-sm">Video coming soon</p>
          </div>
        )}
      </div>

      {/* Title + Complete button */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1A3226]">{video.title}</h1>
          {video.duration_seconds && <p className="text-sm text-[#1A3226]/50 mt-0.5">{formatDuration(video.duration_seconds)}</p>}
          {video.description && <p className="text-[#1A3226]/60 mt-2 text-sm leading-relaxed">{video.description}</p>}
        </div>
        {isCompleted ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-semibold flex-shrink-0 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" /> Completed
          </div>
        ) : (
          <Button onClick={markComplete} variant="outline" size="sm" className="flex-shrink-0 border-[#1A3226]/20">
            <CheckCircle className="w-4 h-4 mr-1.5" /> Mark as Complete
          </Button>
        )}
      </div>

      {/* Transcript */}
      {video.transcript && (
        <div className="border border-[#1A3226]/10 rounded-xl overflow-hidden">
          <button onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#1A3226] hover:bg-[#1A3226]/5 transition-colors">
            Transcript
            <ChevronDown className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`} />
          </button>
          {showTranscript && (
            <div className="px-4 pb-4 text-sm text-[#1A3226]/70 whitespace-pre-wrap leading-relaxed border-t border-[#1A3226]/10 pt-3">
              {video.transcript}
            </div>
          )}
        </div>
      )}

      {/* Next video */}
      {nextVideo && (
        <div className="border border-[#1A3226]/10 rounded-xl p-4">
          <p className="text-xs text-[#1A3226]/40 font-semibold uppercase tracking-wide mb-3">Up Next</p>
          <Link to={`/training/${nextVideo.id}`} className="flex items-center justify-between gap-4 group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-10 bg-[#1A3226]/10 rounded flex-shrink-0 flex items-center justify-center">
                <Play className="w-4 h-4 text-[#1A3226]/30" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A3226] group-hover:text-[#B8982F] transition-colors truncate">{nextVideo.title}</p>
                {nextVideo.duration_seconds && <p className="text-xs text-[#1A3226]/40">{formatDuration(nextVideo.duration_seconds)}</p>}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#1A3226]/30 group-hover:text-[#B8982F] flex-shrink-0 transition-colors" />
          </Link>
        </div>
      )}
    </div>
  );
}