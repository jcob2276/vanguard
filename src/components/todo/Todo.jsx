import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Archive,
  Calendar,
  CheckSquare,
  ChevronLeft,
  Flag,
  Inbox,
  Layers,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import {
  archiveTodoSection,
  createTodoItem,
  createTodoSection,
  listTodoItems,
  listTodoSections,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';

const PRIORITIES = [
  { id: 'low', label: 'low', cls: 'border-white/10 bg-white/[0.04] text-white/40' },
  { id: 'normal', label: 'normal', cls: 'border-blue-500/25 bg-blue-500/10 text-blue-300' },
  { id: 'high', label: 'high', cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300' },
  { id: 'urgent', label: 'urgent', cls: 'border-red-500/25 bg-red-500/10 text-red-300' },
];

const FILTERS = [
  { id: 'open', label: 'Otwarte' },
  { id: 'today', label: 'Dzisiaj' },
  { id: 'someday', label: 'Kiedyś' },
  { id: 'done', label: 'Done' },
];

function priorityClass(priority) {
  return PRIORITIES.find((p) => p.id === priority)?.cls || PRIORITIES[1].cls;
}

function Pill({ active, onClick, children, tone }) {
  const on = tone || 'border-primary/40 bg-primary/15 text-white';
  const off = 'border-white/[0.08] bg-black/30 text-white/40';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${active ? on : off}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ section, count, onArchive }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white/70">{section.name}</h3>
        <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">{count} otwarte</p>
      </div>
      <button
        onClick={onArchive}
        className="rounded-md border border-white/[0.07] p-1.5 text-white/25 transition-colors hover:text-red-300"
        title="Archiwizuj sekcję"
      >
        <Archive size={12} />
      </button>
    </div>
  );
}

export default function Todo({ session, onBack }) {
  const userId = session.user.id;
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('open');
  const [activeSection, setActiveSection] = useState('');
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [form, setForm] = useState({
    title: '',
    notes: '',
    priority: 'normal',
    tagsText: '',
    due_date: '',
  });

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [s, i] = await Promise.all([listTodoSections(userId), listTodoItems(userId)]);
      setSections(s || []);
      setItems(i || []);
      if (!activeSection && s?.length) setActiveSection(s[0].id);
    } catch (err) {
      console.error('Todo fetch:', err);
      setError(err.message);
    }
  }, [activeSection, userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const sectionById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])), [sections]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  const filteredSections = useMemo(() => {
    if (filter === 'done') return sections;
    if (filter === 'someday') return sections.filter((s) => /kiedyś|wizje/i.test(s.name));
    if (filter === 'today') return sections.filter((s) => /teraz|7 dni/i.test(s.name));
    return sections;
  }, [filter, sections]);

  const visibleItems = useCallback((sectionId) => {
    return items.filter((item) => {
      if (item.section_id !== sectionId) return false;
      if (filter === 'done') return item.status === 'done';
      if (filter === 'today') return item.status === 'open' && (item.due_date === today || /teraz|7 dni/i.test(sectionById[item.section_id]?.name || ''));
      if (filter === 'someday') return item.status === 'open' && /kiedyś|wizje/i.test(sectionById[item.section_id]?.name || '');
      return item.status === 'open';
    });
  }, [filter, items, sectionById, today]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await fetchAll();
    } catch (err) {
      console.error('Todo action:', err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addItem = () => {
    if (!form.title.trim()) return;
    run(async () => {
      await createTodoItem(userId, { ...form, section_id: activeSection });
      setForm({ title: '', notes: '', priority: form.priority, tagsText: '', due_date: '' });
    });
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    run(async () => {
      const created = await createTodoSection(userId, newSectionName, sections.length * 10 + 10);
      setActiveSection(created.id);
      setNewSectionName('');
      setShowSectionForm(false);
    });
  };

  const cyclePriority = (item) => {
    const idx = PRIORITIES.findIndex((p) => p.id === item.priority);
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length].id;
    run(() => updateTodoItem(item.id, { priority: next }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-5 text-white">
        <DataStateNotice tone="loading" title="To Do się ładuje" detail="Pobieram sekcje i zadania." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-white/5 pb-8">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-black/85 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="rounded-full border border-white/5 bg-white/5 p-2 text-white/45 hover:text-white" title="Wróć">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[16px] font-black uppercase tracking-tight text-white">
              <Inbox size={16} className="text-primary" /> To Do
            </h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/35">
              {openItems.length} otwarte · własny inbox Vanguard
            </p>
          </div>
        </header>

        <main className="space-y-6 p-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          <section className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
              placeholder="Nazwa zadania — wpisz i Enter"
              className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[14px] font-black text-white outline-none placeholder:text-white/20 focus:border-primary/70"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Opis (opcjonalnie)"
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/35 p-3 text-[12px] font-semibold text-white outline-none placeholder:text-white/20 focus:border-primary/70"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-black text-white outline-none focus:border-primary/70"
              >
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[11px] font-bold text-white/70 outline-none focus:border-primary/70"
                title="Termin"
              />
            </div>
            <input
              value={form.tagsText}
              onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
              placeholder="Tagi po przecinku, np. zakup, projekt"
              className="w-full rounded-lg border border-white/[0.08] bg-black/35 p-3 text-[12px] font-semibold text-white outline-none placeholder:text-white/20 focus:border-primary/70"
            />
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Pill key={p.id} active={form.priority === p.id} tone={p.cls} onClick={() => setForm({ ...form, priority: p.id })}>
                  <Flag size={10} className="mr-1 inline" /> {p.label}
                </Pill>
              ))}
            </div>
            <button
              onClick={addItem}
              disabled={busy || !form.title.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              <Plus size={14} /> Dodaj zadanie
            </button>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Pill>
                ))}
              </div>
              <button
                onClick={() => setShowSectionForm((v) => !v)}
                className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary"
              >
                + Sekcja
              </button>
            </div>
            {showSectionForm && (
              <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-white/[0.08] bg-neutral-950/70 p-3">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSection(); }}
                  placeholder="Nowa sekcja"
                  className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none placeholder:text-white/20 focus:border-primary/70"
                />
                <button onClick={addSection} disabled={busy || !newSectionName.trim()} className="rounded-lg bg-primary px-4 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-50">
                  Dodaj
                </button>
              </div>
            )}
          </section>

          <section className="space-y-4">
            {filteredSections.map((section) => {
              const list = visibleItems(section.id);
              const openCount = items.filter((i) => i.section_id === section.id && i.status === 'open').length;
              if (filter !== 'open' && list.length === 0) return null;
              return (
                <article key={section.id} className="space-y-3 rounded-lg border border-white/[0.07] bg-neutral-950/70 p-4">
                  <SectionTitle section={section} count={openCount} onArchive={() => run(() => archiveTodoSection(section.id))} />
                  {list.length === 0 ? (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Brak zadań w tej sekcji.</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((item) => (
                        <div key={item.id} className={`rounded-lg border p-3 transition-all ${item.status === 'done' ? 'border-emerald-500/10 bg-emerald-500/[0.03] opacity-55' : 'border-white/[0.06] bg-black/35'}`}>
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => run(() => setTodoStatus(item, item.status === 'done' ? 'open' : 'done'))}
                              disabled={busy}
                              className="mt-0.5 text-white/35 transition-colors hover:text-emerald-400"
                              title={item.status === 'done' ? 'Przywróć' : 'Zrobione'}
                            >
                              {item.status === 'done' ? <CheckSquare size={17} /> : <Square size={17} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[12px] font-black uppercase tracking-tight ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/90'}`}>
                                {item.title}
                              </p>
                              {item.notes && <p className="mt-1 text-[10px] font-semibold leading-snug text-white/35">{item.notes}</p>}
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() => cyclePriority(item)}
                                  className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${priorityClass(item.priority)}`}
                                  title="Zmień priorytet"
                                >
                                  {item.priority}
                                </button>
                                {item.due_date && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-black uppercase text-white/45">
                                    <Calendar size={9} /> {format(new Date(item.due_date), 'd MMM')}
                                  </span>
                                )}
                                {(item.tags || []).map((tag) => (
                                  <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-black uppercase text-white/35">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => run(() => setTodoStatus(item, 'dropped'))}
                              disabled={busy}
                              className="text-white/20 transition-colors hover:text-red-300"
                              title="Odpuść"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {filteredSections.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] p-5 text-center">
                <Layers size={18} className="mx-auto mb-2 text-primary" />
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Brak sekcji</p>
                <p className="mt-1 text-[10px] font-semibold text-white/30">Dodaj pierwszą sekcję i wrzuć tam zadania.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
