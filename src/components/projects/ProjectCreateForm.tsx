import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';
import { COLORS } from './projectUtils';
import { Card } from '../ui/Card';

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
    <Card variant="surface" padding="1rem" className="space-y-3">
      <ControlInput
        autoFocus
        value={form.name}
        onChange={e => onChange({ name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        placeholder="Nazwa projektu..."
        className="w-full bg-transparent text-base font-medium text-text-primary outline-none placeholder:text-text-muted/40"
      />
      <ControlInput
        value={form.goal}
        onChange={e => onChange({ goal: e.target.value })}
        placeholder="Cel / kim staję się realizując ten projekt..."
        className="w-full bg-transparent text-sm text-text-secondary outline-none placeholder:text-text-muted/35"
      />
      <div className="flex items-center gap-3">
        <ControlInput
          type="date"
          value={form.deadline}
          onChange={e => onChange({ deadline: e.target.value })}
          className="flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-sm font-medium text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
        />
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <Button
              key={c.id}
              variant="ghost"
              onClick={() => onChange({ color: c.id })}
              className={`h-6 w-6 min-w-0 p-0 rounded-full ${c.dot} transition-transform ${form.color === c.id ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-[var(--opacity-50)] hover:opacity-[var(--opacity-80)]'}`}
            />
          ))}
        </div>
      </div>
      <Button
        onClick={onSubmit}
        disabled={busy || !form.name.trim()}
        className="w-full py-2.5 text-sm"
      >
        Utwórz projekt i sekcję w Zadaniach
      </Button>
    </Card>
  );
}
