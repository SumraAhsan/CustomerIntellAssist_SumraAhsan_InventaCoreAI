import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, BookOpen, Search } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, Button, Input, Textarea, Select, Modal, Field, EmptyState } from '../components/ui/ui';
import { CATEGORIES } from '../lib/constants';
import { logAudit, listKnowledgeArticles } from '../lib/repo';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Knowledge() {
  const { profile } = useApp();
  const canEdit = profile?.role && profile.role !== 'Viewer';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', content: '' });
  const [error, setError] = useState('');

  const articles = useLiveQuery(() => listKnowledgeArticles(), []) ?? EMPTY_ARR;

  const filtered = articles.filter((a) => {
    const matchesSearch = `${a.title} ${a.content}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !category || a.category === category;
    return matchesSearch && matchesCategory;
  });

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { setError('Title and content are required.'); return; }
    const id = await db.knowledgeArticles.add({
      ...form, tags: [form.category.toLowerCase()], status: 'Published',
      createdBy: profile?.name || 'Admin', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await logAudit(profile?.name || 'Admin', 'created knowledge article', 'knowledge', id, form.title);
    setForm({ title: '', category: 'General', content: '' }); setError(''); setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {canEdit && <Button onClick={() => setModalOpen(true)} className="ml-auto"><Plus size={16} /> New article</Button>}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="No articles found" description="Try a different search, or add a new article." action={canEdit ? <Button onClick={() => setModalOpen(true)}>New article</Button> : null} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="font-medium text-sm text-ink dark:text-slate-100">{a.title}</p>
                <Badge color="info">{a.category}</Badge>
              </div>
              <p className="text-xs text-ink-soft dark:text-slate-400 line-clamp-4">{a.content}</p>
              <p className="text-[11px] text-ink-faint mt-2">By {a.createdBy}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New knowledge article" wide footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={submit}>Publish</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <Field label="Content"><Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
          {error && <p className="text-sm text-critical">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
