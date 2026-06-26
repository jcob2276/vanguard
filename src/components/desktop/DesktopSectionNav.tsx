const SECTIONS = [
  { id: 'korelacje', label: 'Korelacje' },
  { id: 'trening', label: 'Trening' },
  { id: 'biometria', label: 'Biometria' },
  { id: 'badania', label: 'Badania' },
  { id: 'kierunek', label: 'Kierunek' },
  { id: 'pamiec', label: 'Pamięć' },
  { id: 'sprint', label: 'Sprint' },
] as const;

export default function DesktopSectionNav() {
  return (
    <nav className="hidden xl:block sticky top-24 self-start w-36 shrink-0 pt-1">
      <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted mb-3 px-2">Sekcje</p>
      <ul className="space-y-1">
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block rounded-lg px-2 py-1.5 text-[10px] font-bold text-text-muted hover:text-primary hover:bg-primary/[0.06] transition-colors"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
