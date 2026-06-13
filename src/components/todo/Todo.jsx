import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  Inbox,
  Plus,
  Settings2,
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
  { id: 'low', label: 'low', dot: 'bg-white/25', chip: 'text-white/35' },
  { id: 'normal', label: 'normal', dot: 'bg-primary/70', chip: 'text-primary/70' },
  { id: 'high', label: 'high', dot: 'bg-amber-400', chip: 'text-amber-300' },
  { id: 'urgent', label: 'urgent', dot: 'bg-red-400', chip: 'text-red-300' },
];

const FILTERS = [
  { id: 'open', label: 'Otwarte' },
  { id: 'today', label: 'Dzisiaj' },
  { id: 'someday', label: 'Kiedyś' },
  { id: 'done', label: 'Done' },
];

function priorityMeta(priority) {
  return PRIORITIES.find((p) => p.id === priority) || PRIORITIES[1];
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
        active ? 'bg-white text-black' : 'bg-white/[0.045] text-white/35 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function QuickField({ children }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3">{children}</div>;
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
  const [showOptions, setShowOptions] = useState(false);
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
      setShowOptions(false);
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
          <button onClick={onBack} className="rounded-full bg-white/[0.04] p-2 text-white/45 hover:text-white" title="Wróć">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[16px] font-black uppercase tracking-tight text-white">
              <Inbox size={16} className="text-primary" /> To Do
            </h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
              {openItems.length} otwarte · szybki inbox
            </p>
          </div>
        </header>

        <main className="space-y-5 p-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          <section className="rounded-2xl bg-white/[0.035] p-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="Wrzuć rzecz do zrobienia..."
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-[15px] font-bold text-white outline-none placeholder:text-white/22"
              />
              <button
                onClick={() => setShowOptions((v) => !v)}
                className={`rounded-full p-2 transition-colors ${showOptions ? 'bg-primary/15 text-primary' : 'bg-black/30 text-white/35 hover:text-white'}`}
                title="Opcje"
              >
                <Settings2 size={17} />
              </button>
              <button
                onClick={addItem}
                disabled={busy || !form.title.trim()}
                className="rounded-full bg-primary p-2.5 text-white shadow-lg shadow-primary/20 disabled:opacity-35"
                title="Dodaj"
              >
                <Plus size={17} />
              </button>
            </div>

            {showOptions && (
              <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
                <QuickField>
                  <select
                    value={activeSection}
                    onChange={(e) => setActiveSection(e.target.value)}
                    className="w-full bg-transparent text-[12px] font-black text-white outline-none"
                  >
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </QuickField>
                <QuickField>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Opis, link albo kontekst..."
                    className="w-full resize-none bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-white/22"
                  />
                </QuickField>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <QuickField>
                    <input
                      value={form.tagsText}
                      onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                      placeholder="tagi: zakup, projekt"
                      className="w-full bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-white/22"
                    />
                  </QuickField>
                  <QuickField>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="bg-transparent text-[11px] font-bold text-white/70 outline-none"
                    />
                  </QuickField>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <Chip key={p.id} active={form.priority === p.id} onClick={() => setForm({ ...form, priority: p.id })}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
                ))}
              </div>
              <button
                onClick={() => setShowSectionForm((v) => !v)}
                className="shrink-0 rounded-full bg-white/[0.045] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary"
              >
                + Sekcja
              </button>
            </div>
            {showSectionForm && (
              <div className="flex gap-2 rounded-2xl bg-white/[0.035] p-3">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSection(); }}
                  placeholder="Nowa sekcja"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-white/22"
                />
                <button onClick={addSection} disabled={busy || !newSectionName.trim()} className="rounded-full bg-primary px-4 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-40">
                  Dodaj
                </button>
              </div>
            )}
          </section>

          <section className="space-y-6">
            {filteredSections.map((section) => {
              const list = visibleItems(section.id);
              const openCount = items.filter((i) => i.section_id === section.id && i.status === 'open').length;
              if (filter !== 'open' && list.length === 0) return null;
              return (
                <article key={section.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white/62">{section.name}</h3>
                      <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-white/22">{openCount} otwarte</p>
                    </div>
                    <button
                      onClick={() => run(() => archiveTodoSection(section.id))}
                      className="text-white/16 transition-colors hover:text-red-300"
                      title="Archiwizuj sekcję"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="px-1 py-2 text-[10px] font-bold uppercase tracking-widest text-white/18">Pusto.</p>
                  ) : (
                    <div className="overflow-hidden rounded-2xl bg-white/[0.028]">
                      {list.map((item) => {
                        const meta = priorityMeta(item.priority);
                        return (
                          <div key={item.id} className="group border-b border-white/[0.045] px-3 py-3 last:border-b-0">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => run(() => setTodoStatus(item, item.status === 'done' ? 'open' : 'done'))}
                                disabled={busy}
                                className="mt-0.5 text-white/30 transition-colors hover:text-emerald-400"
                                title={item.status === 'done' ? 'Przywróć' : 'Zrobione'}
                              >
                                {item.status === 'done' ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] font-bold leading-snug ${item.status === 'done' ? 'text-white/28 line-through' : 'text-white/88'}`}>
                                  {item.title}
                                </p>
                                {item.notes && <p className="mt-1 text-[10px] font-semibold leading-snug text-white/32">{item.notes}</p>}
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <button
                                    onClick={() => cyclePriority(item)}
                                    className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${meta.chip}`}
                                    title="Zmień priorytet"
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                    {item.priority}
                                  </button>
                                  {item.due_date && (
                                    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-white/32">
                                      <Calendar size={9} /> {format(new Date(item.due_date), 'd MMM')}
                                    </span>
                                  )}
                                  {(item.tags || []).map((tag) => (
                                    <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-white/26">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => run(() => setTodoStatus(item, 'dropped'))}
                                disabled={busy}
                                className="text-white/0 transition-colors group-hover:text-white/18 hover:!text-red-300"
                                title="Odpuść"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
