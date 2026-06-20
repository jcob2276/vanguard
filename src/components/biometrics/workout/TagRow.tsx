import { useState } from 'react';
import { X } from 'lucide-react';
import { ALL_TAGS, tagClass } from '../../../data/exercises';

interface TagRowProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagRow({ tags, onChange }: TagRowProps) {
  const [picking, setPicking] = useState(false);
  const available = ALL_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
      {tags.map((t) => (
        <button
          key={t}
          onClick={() => onChange(tags.filter((x) => x !== t))}
          className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(t)} transition-opacity hover:opacity-70 cursor-pointer`}
        >
          {t} <X size={8} />
        </button>
      ))}
      {available.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setPicking((p) => !p)}
            onBlur={() => setTimeout(() => setPicking(false), 150)}
            className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-dashed border-border-custom text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer"
          >
            + tag
          </button>
          {picking && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl border border-border-custom bg-surface-solid shadow-lg p-2 flex flex-wrap gap-1 w-52">
              {available.map((t) => (
                <button
                  key={t}
                  onMouseDown={() => {
                    onChange([...tags, t]);
                    setPicking(false);
                  }}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(t)} hover:opacity-80 transition-opacity cursor-pointer`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
