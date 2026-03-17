import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Pencil, GripVertical, Eye, EyeOff, BarChart2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoFormDialog from '@/components/admin/training/VideoFormDialog';
import ModuleFormDialog from '@/components/admin/training/ModuleFormDialog';

const CATEGORY_LABELS = {
  getting_started: 'Getting Started', cma: 'Running a CMA',
  market_reports: 'Market Reports', presentations: 'Buyer & Seller Presentations',
  territory: 'Managing Your Territory', advanced: 'Advanced Techniques',
};

function formatDuration(s) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function TrainingAdmin() {
  const [modules, setModules] = useState([]);
  const [videos, setVideos] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [tab, setTab] = useState('content');
  const [videoDialog, setVideoDialog] = useState({ open: false, editVideo: null });
  const [moduleDialog, setModuleDialog] = useState({ open: false, editModule: null });
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [mods, vids, prog] = await Promise.all([
      base44.entities.TrainingModule.list('sort_order', 200),
      base44.entities.TrainingVideo.list('sort_order', 500),
      base44.entities.TrainingProgress.list('-created_date', 500),
    ]);
    setModules(mods);
    setVideos(vids);
    setAllProgress(prog);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function toggleModulePublished(mod) {
    await base44.entities.TrainingModule.update(mod.id, { is_published: !mod.is_published });
    setModules(ms => ms.map(m => m.id === mod.id ? { ...m, is_published: !m.is_published } : m));
  }

  async function toggleVideoPublished(vid) {
    await base44.entities.TrainingVideo.update(vid.id, { is_published: !vid.is_published });
    setVideos(vs => vs.map(v => v.id === vid.id ? { ...v, is_published: !v.is_published } : v));
  }

  async function handleDragEnd(result) {
    if (!result.destination) return;
    const moduleId = result.source.droppableId;
    const moduleVids = videos.filter(v => v.module_id === moduleId).sort((a, b) => a.sort_order - b.sort_order);
    const reordered = Array.from(moduleVids);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    const updated = reordered.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setVideos(prev => [...prev.filter(v => v.module_id !== moduleId), ...updated]);
    await Promise.all(updated.map(v => base44.entities.TrainingVideo.update(v.id, { sort_order: v.sort_order })));
  }

  // Stats
  function getVideoStats(videoId) {
    const prog = allProgress.filter(p => p.video_id === videoId);
    const started = prog.length;
    const completed = prog.filter(p => p.is_completed).length;
    const avgWatch = started > 0 ? Math.round(prog.reduce((s, p) => s + (p.watch_time_seconds || 0), 0) / started) : 0;
    return { started, completed, avgWatch };
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Training Management</h1>
          <p className="text-sm text-[#1A3226]/50 mt-1">{modules.length} modules · {videos.length} videos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModuleDialog({ open: true, editModule: null })} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Module
          </Button>
          <Button onClick={() => setVideoDialog({ open: true, editVideo: null })} size="sm"
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Video
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1A3226]/10">
        {[{ id: 'content', label: 'Modules & Videos', icon: BookOpen }, { id: 'stats', label: 'Completion Stats', icon: BarChart2 }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-[#1A3226] text-[#1A3226]' : 'border-transparent text-[#1A3226]/50 hover:text-[#1A3226]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {modules.sort((a, b) => a.sort_order - b.sort_order).map(mod => {
              const modVids = videos.filter(v => v.module_id === mod.id).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={mod.id} className="border border-[#1A3226]/10 rounded-xl overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#1A3226]/3 border-b border-[#1A3226]/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mod.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {mod.is_published ? 'Published' : 'Draft'}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-[#1A3226] text-sm">{mod.title}</span>
                        <span className="ml-2 text-xs text-[#1A3226]/40">{CATEGORY_LABELS[mod.category]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#1A3226]/40">{modVids.length} videos</span>
                      <button onClick={() => toggleModulePublished(mod)} className="p-1 text-[#1A3226]/40 hover:text-[#1A3226] transition-colors" title={mod.is_published ? 'Unpublish' : 'Publish'}>
                        {mod.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setModuleDialog({ open: true, editModule: mod })} className="p-1 text-[#1A3226]/40 hover:text-[#1A3226] transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Videos */}
                  <Droppable droppableId={mod.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {modVids.map((vid, index) => (
                          <Draggable draggableId={vid.id} index={index} key={vid.id}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}
                                className={`flex items-center gap-3 px-4 py-3 border-b border-[#1A3226]/5 last:border-0 ${snapshot.isDragging ? 'bg-[#B8982F]/5 shadow-md' : 'bg-white hover:bg-[#1A3226]/2'}`}>
                                <div {...provided.dragHandleProps} className="text-[#1A3226]/20 hover:text-[#1A3226]/50 cursor-grab flex-shrink-0">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-[#1A3226] truncate">{vid.title}</span>
                                    {vid.requires_tier && (
                                      <span className="text-xs bg-[#B8982F]/10 text-[#B8982F] px-1.5 py-0.5 rounded font-medium">
                                        {vid.requires_tier === 'team' ? 'Team' : 'Pro+'}
                                      </span>
                                    )}
                                    {!vid.heygen_embed_url && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">No video</span>}
                                  </div>
                                  <p className="text-xs text-[#1A3226]/40 mt-0.5">{formatDuration(vid.duration_seconds)}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${vid.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {vid.is_published ? 'Live' : 'Draft'}
                                  </span>
                                  <button onClick={() => toggleVideoPublished(vid)} className="p-1 text-[#1A3226]/40 hover:text-[#1A3226] transition-colors">
                                    {vid.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => setVideoDialog({ open: true, editVideo: vid })} className="p-1 text-[#1A3226]/40 hover:text-[#1A3226] transition-colors">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {modVids.length === 0 && (
                          <div className="px-4 py-3 text-xs text-[#1A3226]/30 italic">No videos yet — add one above.</div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {tab === 'stats' && (
        <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/5 text-[#1A3226]/60 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Video</th>
                <th className="text-left px-4 py-3">Module</th>
                <th className="text-right px-4 py-3">Started</th>
                <th className="text-right px-4 py-3">Completed</th>
                <th className="text-right px-4 py-3">Avg Watch</th>
              </tr>
            </thead>
            <tbody>
              {videos.sort((a, b) => a.sort_order - b.sort_order).map(vid => {
                const mod = modules.find(m => m.id === vid.module_id);
                const stats = getVideoStats(vid.id);
                return (
                  <tr key={vid.id} className="border-t border-[#1A3226]/5 hover:bg-[#1A3226]/2">
                    <td className="px-4 py-3 font-medium text-[#1A3226]">{vid.title}</td>
                    <td className="px-4 py-3 text-[#1A3226]/50">{mod?.title || '—'}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/70">{stats.started}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={stats.completed > 0 ? 'text-green-600 font-medium' : 'text-[#1A3226]/40'}>
                        {stats.completed}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/50">{formatDuration(stats.avgWatch)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <VideoFormDialog
        open={videoDialog.open}
        onClose={() => setVideoDialog({ open: false, editVideo: null })}
        onSaved={loadData}
        modules={modules}
        editVideo={videoDialog.editVideo}
      />
      <ModuleFormDialog
        open={moduleDialog.open}
        onClose={() => setModuleDialog({ open: false, editModule: null })}
        onSaved={loadData}
        editModule={moduleDialog.editModule}
      />
    </div>
  );
}