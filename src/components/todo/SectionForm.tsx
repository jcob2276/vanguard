import React from 'react';
import { Card } from '../ui/Card';

interface SectionFormProps {
  name: string;
  notes: string;
  onChangeName: (val: string) => void;
  onChangeNotes: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function SectionForm({
  name,
  notes,
  onChangeName,
  onChangeNotes,
  onSave,
  onCancel,
}: SectionFormProps) {
  return (
    <Card className="border border-border-custom bg-surface-solid/40 mb-3 flex flex-col gap-3 shadow-lg" padding="1.125rem">
      <input
        autoFocus
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="Nazwij tę sekcję"
        className="w-full bg-transparent text-[14px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
      />
      <textarea
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        rows={2}
        placeholder="Dodaj opis"
        className="w-full resize-none bg-transparent text-[12px] font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
      />
      <div className="flex gap-2 justify-start mt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!name.trim()}
          className="todoist-btn-primary"
        >
          Dodaj sekcję
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="todoist-btn-secondary"
        >
          Anuluj
        </button>
      </div>
    </Card>
  );
}
