import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function secondsToMMSS(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function mmssToSeconds(str) {
  if (!str) return null;
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
  return parseInt(str);
}

export default function VideoFormDialog({ open, onClose, onSaved, modules, editVideo = null }) {
  const [form, setForm] = useState({
    module_id: '', title: '', description: '', heygen_video_id: '',
    heygen_embed_url: '', thumbnail_url: '', duration_mmss: '',
    transcript: '', requires_tier: '', sort_order: 1, is_published: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editVideo) {
      setForm({
        module_id: editVideo.module_id || '',
        title: editVideo.title || '',
        description: editVideo.description || '',
        heygen_video_id: editVideo.heygen_video_id || '',
        heygen_embed_url: editVideo.heygen_embed_url || '',
        thumbnail_url: editVideo.thumbnail_url || '',
        duration_mmss: secondsToMMSS(editVideo.duration_seconds),
        transcript: editVideo.transcript || '',
        requires_tier: editVideo.requires_tier || '',
        sort_order: editVideo.sort_order ?? 1,
        is_published: editVideo.is_published || false,
      });
    } else {
      setForm({ module_id: modules[0]?.id || '', title: '', description: '', heygen_video_id: '',
        heygen_embed_url: '', thumbnail_url: '', duration_mmss: '', transcript: '',
        requires_tier: '', sort_order: 1, is_published: false });
    }
  }, [editVideo, open, modules]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSave() {
    if (!form.title || !form.module_id) return;
    setSaving(true);
    const data = {
      module_id: form.module_id,
      title: form.title,
      description: form.description,
      heygen_video_id: form.heygen_video_id || null,
      heygen_embed_url: form.heygen_embed_url || null,
      thumbnail_url: form.thumbnail_url || null,
      duration_seconds: mmssToSeconds(form.duration_mmss),
      transcript: form.transcript || null,
      requires_tier: form.requires_tier || null,
      sort_order: parseInt(form.sort_order) || 1,
      is_published: form.is_published,
    };
    if (editVideo) {
      await base44.entities.TrainingVideo.update(editVideo.id, data);
    } else {
      await base44.entities.TrainingVideo.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editVideo ? 'Edit Video' : 'Add Video'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Module *</Label>
            <select value={form.module_id} onChange={e => set('module_id', e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent">
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div>
            <Label>Title *</Label>
            <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Video title" />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent resize-none h-20" placeholder="Short description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>HeyGen Video ID</Label>
              <Input className="mt-1" value={form.heygen_video_id} onChange={e => set('heygen_video_id', e.target.value)} placeholder="Paste HeyGen ID" />
            </div>
            <div>
              <Label>Duration (mm:ss)</Label>
              <Input className="mt-1" value={form.duration_mmss} onChange={e => set('duration_mmss', e.target.value)} placeholder="e.g. 4:32" />
            </div>
          </div>
          <div>
            <Label>HeyGen Embed URL</Label>
            <Input className="mt-1" value={form.heygen_embed_url} onChange={e => set('heygen_embed_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Thumbnail URL</Label>
            <Input className="mt-1" value={form.thumbnail_url} onChange={e => set('thumbnail_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Transcript</Label>
            <textarea value={form.transcript} onChange={e => set('transcript', e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent resize-none h-28" placeholder="Paste transcript text..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tier Requirement</Label>
              <select value={form.requires_tier} onChange={e => set('requires_tier', e.target.value)}
                className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent">
                <option value="">All tiers</option>
                <option value="pro">Pro+ only</option>
                <option value="team">Team only</option>
              </select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input className="mt-1" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-foreground">Published</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.module_id}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white">
            {saving ? 'Saving…' : 'Save Video'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}