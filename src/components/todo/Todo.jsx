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
import { parseTodoQuickInput } from '../../lib/todoParser';

const PRIORITIES = [
  { id: 'low', label: 'low', dot: 'bg-text-muted/60', chip: 'text-text-muted bg-text-primary/5 border border-border-custom' },
  { id: 'normal', label: 'normal', dot: 'bg-primary', chip: 'text-primary bg-primary/5 border border-primary/10' },
  { id: 'high', label: 'high', dot: 'bg-amber-500', chip: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/15' },
  { id: 'urgent', label: 'urgent', dot: 'bg-rose-500', chip: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/15' },
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
        active 
          ? 'bg-text-primary text-background shadow-sm' 
          : 'bg-surface border border-border-custom text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function QuickField({ children }) {
  return <div className="rounded-xl border border-border-custom bg-surface p-3">{children}</div>;
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
  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
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
    const title = parsedInput.title || form.title.trim();
    if (!title) return;
    run(async () => {
      await createTodoItem(userId, {
        ...form,
        title,
        priority: parsedInput.priority || form.priority,
        due_date: parsedInput.due_date || form.due_date,
        section_id: activeSection,
      });
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
      <div className="min-h-screen bg-background p-5 text-text-primary flex items-center justify-center transition-colors duration-300">
        <DataStateNotice tone="loading" title="To Do się ładuje" detail="Pobieram sekcje i zadania." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl pb-8 shadow-sm">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom bg-background/80 px-5 py-4 backdrop-blur-xl">
          <button 
            onClick={onBack} 
            className="rounded-full border border-border-custom bg-surface/50 p-2 text-text-secondary hover:text-text-primary hover:bg-surface shadow-sm transition-colors" 
            title="Wróć"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[16px] font-black uppercase tracking-tight text-text-primary font-display">
              <Inbox size={16} className="text-primary" /> To Do
            </h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mt-0.5">
              {openItems.length} otwarte · szybki inbox
            </p>
          </div>
        </header>

        <main className="space-y-5 p-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          <section className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-4.5 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="Wrzuć rzecz do zrobienia..."
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-[15px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
              />
              <button
                onClick={() => setShowOptions((v) => !v)}
                className={`rounded-full p-2.5 transition-colors border border-border-custom ${showOptions ? 'bg-primary/15 text-primary border-primary/20' : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-solid'}`}
                title="Opcje"
              >
                <Settings2 size={17} />
              </button>
              <button
                onClick={addItem}
                disabled={busy || !form.title.trim()}
                className="rounded-full bg-primary p-2.5 text-white shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all cursor-pointer"
                title="Dodaj"
              >
                <Plus size={17} />
              </button>
            </div>

            {(parsedInput.tokens.length > 0 || (parsedInput.title && parsedInput.title !== form.title.trim())) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
                {parsedInput.tokens.map((token) => {
                  if (token.type === 'priority') {
                    const meta = priorityMeta(token.value);
                    return (
                      <span
                        key={`${token.type}-${token.value}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${meta.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {token.label}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={`${token.type}-${token.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary"
                    >
                      <Calendar size={10} />
                      {token.label}
                    </span>
                  );
                })}
                {parsedInput.title && parsedInput.title !== form.title.trim() && (
                  <span className="min-w-0 truncate text-[10px] font-bold text-text-muted">
                    zapiszę jako: <span className="text-text-secondary font-bold">{parsedInput.title}</span>
                  </span>
                )}
              </div>
            )}

            {showOptions && (
              <div className="mt-3 space-y-3 border-t border-border-custom pt-3">
                <QuickField>
                  <select
                    value={activeSection}
                    onChange={(e) => setActiveSection(e.target.value)}
                    className="w-full bg-transparent text-[12px] font-black text-text-primary outline-none cursor-pointer"
                  >
                    {sections.map((s) => <option key={s.id} value={s.id} className="bg-surface-solid text-text-primary">{s.name}</option>)}
                  </select>
                </QuickField>
                <QuickField>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Opis, link albo kontekst..."
                    className="w-full resize-none bg-transparent text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                  />
                </QuickField>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <QuickField>
                    <input
                      value={form.tagsText}
                      onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                      placeholder="tagi: zakup, projekt"
                      className="w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                    />
                  </QuickField>
                  <QuickField>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="bg-transparent text-[11px] font-bold text-text-secondary outline-none cursor-pointer"
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
                className="shrink-0 rounded-full border border-border-custom bg-surface px-3.5 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-surface-solid hover:border-primary/20 transition-all cursor-pointer"
              >
                + Sekcja
              </button>
            </div>
            {showSectionForm && (
              <div className="flex gap-2 rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-3">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSection(); }}
                  placeholder="Nowa sekcja"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
                />
                <button 
                  onClick={addSection} 
                  disabled={busy || !newSectionName.trim()} 
                  className="rounded-full bg-primary px-4 text-[9px] font-black uppercase tracking-widest text-white hover:bg-primary-hover active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
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
                      <h3 className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-text-primary font-display">{section.name}</h3>
                      <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-text-muted">{openCount} otwarte</p>
                    </div>
                    <button
                      onClick={() => run(() => archiveTodoSection(section.id))}
                      className="text-text-muted/60 transition-colors hover:text-rose-500"
                      title="Archiwizuj sekcję"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="px-1 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">Pusto.</p>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-border-custom bg-surface backdrop-blur-sm shadow-sm">
                      {list.map((item) => {
                        const meta = priorityMeta(item.priority);
                        return (
                          <div key={item.id} className="group border-b border-border-custom px-3.5 py-3.5 last:border-b-0 transition-colors hover:bg-primary/[0.01] dark:hover:bg-white/[0.01]">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => run(() => setTodoStatus(item, item.status === 'done' ? 'open' : 'done'))}
                                disabled={busy}
                                className="mt-0.5 text-text-muted hover:text-emerald-500 transition-colors"
                                title={item.status === 'done' ? 'Przywróć' : 'Zrobione'}
                              >
                                {item.status === 'done' ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] font-semibold leading-snug ${item.status === 'done' ? 'text-text-muted line-through opacity-70' : 'text-text-primary'}`}>
                                  {item.title}
                                </p>
                                {item.notes && <p className="mt-1 text-[10px] font-medium leading-snug text-text-secondary">{item.notes}</p>}
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <button
                                    onClick={() => cyclePriority(item)}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${meta.chip}`}
                                    title="Zmień priorytet"
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                    {item.priority}
                                  </button>
                                  {item.due_date && (
                                    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-text-muted">
                                      <Calendar size={9} /> {format(new Date(item.due_date), 'd MMM')}
                                    </span>
                                  )}
                                  {(item.tags || []).map((tag) => (
                                    <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-text-muted/80 bg-text-primary/[0.04] px-1.5 py-0.5 rounded-md border border-border-custom">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => run(() => setTodoStatus(item, 'dropped'))}
                                disabled={busy}
                                className="text-text-muted/0 transition-colors group-hover:text-text-muted/60 hover:!text-rose-500 p-1 rounded hover:bg-rose-500/5"
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
