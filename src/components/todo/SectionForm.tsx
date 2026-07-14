import React from 'react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';

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
        className="w-full bg-transparent text-base font-bold text-text-primary outline-none placeholder:text-text-muted/40"
      />
      <textarea
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        rows={2}
        placeholder="Dodaj opis"
        className="w-full resize-none bg-transparent text-sm font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
      />
      <div className="flex gap-2 justify-start mt-1">
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!name.trim()}
        >
          Dodaj sekcję
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Anuluj
        </Button>
      </div>
    </Card>
  );
}
