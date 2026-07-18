import type { LucideIcon } from 'lucide-react';

interface HorizonHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function HorizonHeader({ eyebrow, title, description, icon: Icon }: HorizonHeaderProps) {
  return (
    <header className="px-1 pb-1 pt-2">
      <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-primary">
        <Icon size={12} /> {eyebrow}
      </p>
      <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-text-primary">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">{description}</p>
    </header>
  );
}
