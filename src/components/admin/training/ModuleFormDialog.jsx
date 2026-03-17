import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIES = [
  { id: 'getting_started', label: 'Getting Started' },
  { id: 'cma', label: 'Running a CMA' },
  { id: 'market_reports', label: 'Market Reports' },
  { id: 'presentations', label: 'Buyer & Seller Presentations' },
  { id: 'territory', label: 'Managing Your Territory' },
  { id: 'advanced', label: 'Advanced Techniques' },
];

export default function ModuleFormDialog({ open, onClose, onSaved, editModule = null }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'getting_started', sort_order: 1, is_published: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editModule) {
      setForm({ title: editModule.title || '', description: editModule.description || '',
        category: editModule.category || 'getting_started', sort_order: editModule.sort_order ?? 1,
        is_published: editModule.is_published || false });
    } else {
      setForm({ title: '', description: '', category: 'getting_started', sort_order: 1, is_published: false });
    }
  }, [editModule, open]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSave() {
    if (!form.title) return;
    setSaving(true);
    const data = { title: form.title, description: form.description, category: form.category,
      sort_order: parseInt(form.sort_order) || 1, is_published: form.is_published };
    if (editModule) {
      await base44.entities.TrainingModule.update(editModule.id, data);
    } else {
      await base44.entities.TrainingModule.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editModule ? 'Edit Module' : 'Add Module'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Module title" />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent resize-none h-20" />
          </div>
          <div>
            <Label>Category</Label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Sort Order</Label>
            <Input className="mt-1" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-foreground">Published</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title}
            className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white">
            {saving ? 'Saving…' : 'Save Module'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}