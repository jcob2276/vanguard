import React, { useState, useEffect, useRef } from 'react';
import { EXERCISES, tagClass, normalize } from '../../../data/exercises';

interface ExerciseNameInputProps {
  value: string;
  tags: string[];
  onChange: (name: string, tags: string[]) => void;
}

export default function ExerciseNameInput({
  value,
  tags,
  onChange,
}: ExerciseNameInputProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync external value → local query (e.g. on reset)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const matches =
    query.trim().length === 0
      ? []
      : EXERCISES.filter((e) => normalize(e.name).includes(normalize(query))).slice(0, 8);

  function select(ex: (typeof EXERCISES)[number]) {
    setQuery(ex.name);
    onChange(ex.name, ex.tags);
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v, tags); // keep existing tags when typing freely
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nazwa ćwiczenia..."
        className="w-full bg-transparent text-sm font-bold text-text-primary outline-none placeholder:text-text-muted/40"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border-custom bg-surface-solid shadow-lg overflow-hidden">
          {matches.map((ex) => (
            <button
              key={ex.name}
              onMouseDown={() => select(ex)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-text-primary/[0.04] transition-colors gap-3 cursor-pointer"
            >
              <span className="text-sm text-text-primary font-medium">{ex.name}</span>
              <div className="flex gap-1 shrink-0">
                {ex.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${tagClass(t)}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
