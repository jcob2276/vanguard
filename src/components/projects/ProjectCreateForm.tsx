import { COLORS } from './projectUtils';

interface ProjectForm {
  name: string;
  goal: string;
  deadline: string;
  color: string;
  dream_id: string;
}

interface Props {
  form: ProjectForm;
  busy: boolean;
  onChange: (patch: Partial<ProjectForm>) => void;
  onSubmit: () => void;
}

export function ProjectCreateForm({ form, busy, onChange, onSubmit }: Props) {
  return (
    <div className="rounded-[24px] border border-border-custom bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] p-4 space-y-3">
      <input
        autoFocus
        value={form.name}
        onChange={e => onChange({ name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        placeholder="Nazwa projektu..."
        className="w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
      />
      <input
        value={form.goal}
        onChange={e => onChange({ goal: e.target.value })}
        placeholder="Cel / kim staję się realizując ten projekt..."
        className="w-full bg-transparent text-[13px] text-text-secondary outline-none placeholder:text-text-muted/35"
      />
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={form.deadline}
          onChange={e => onChange({ deadline: e.target.value })}
          className="flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
        />
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => onChange({ color: c.id })}
              className={`h-6 w-6 rounded-full ${c.dot} transition-transform ${form.color === c.id ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-50 hover:opacity-80'}`}
            />
          ))}
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={busy || !form.name.trim()}
        className="w-full rounded-[12px] bg-primary py-2.5 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
      >
        Utwórz projekt i sekcję w Zadaniach
      </button>
    </div>
  );
}
