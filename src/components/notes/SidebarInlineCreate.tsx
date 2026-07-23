import { useState } from 'react';
import { ControlInput } from '../ui/ControlPrimitives';

interface SidebarInlineCreateProps {
  placeholder: string;
  onCancel: () => void;
  onSubmit: (value: string) => Promise<void>;
}

export default function SidebarInlineCreate({
  placeholder,
  onCancel,
  onSubmit,
}: SidebarInlineCreateProps) {
  const [value, setValue] = useState('');

  const submit = async () => {
    if (!value.trim()) return;
    await onSubmit(value);
  };

  return (
    <div className="px-2 py-1">
      <ControlInput
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={event => setValue(event.target.value)}
        onBlur={() => { if (!value.trim()) onCancel(); }}
        onKeyDown={event => {
          if (event.key === 'Enter') void submit();
          if (event.key === 'Escape') onCancel();
        }}
        className="h-8 text-xs"
      />
    </div>
  );
}
