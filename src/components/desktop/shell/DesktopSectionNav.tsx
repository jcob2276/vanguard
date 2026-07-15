import { Link } from 'react-router-dom';
import { useActiveSection } from './useActiveSection';

const SECTIONS: { id: string; label: string; href?: string }[] = [
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'korelacje', label: 'Korelacje', href: '/korelacje' },
  { id: 'trening', label: 'Trening' },
  { id: 'biometria', label: 'Biometria' },
  { id: 'badania', label: 'Badania' },
  { id: 'kierunek', label: 'Kierunek' },
  { id: 'pamiec', label: 'Pamięć' },
  { id: 'sprint', label: 'Sprint' },
];

const sectionIds = SECTIONS.map(s => s.id);

function linkClass(id: string, activeSection: string | null) {
  const isActive = activeSection === id;
  return `block rounded-lg px-2 py-1.5 text-xs font-bold transition-all duration-[var(--motion-medium)] ${
    isActive
      ? 'nav-pill-active text-primary'
      : 'text-text-muted hover:text-primary hover:bg-primary/[0.08]'
  }`;
}

export default function DesktopSectionNav() {
  const activeSection = useActiveSection(sectionIds);

  return (
    <nav className="hidden xl:block sticky top-24 self-start w-36 shrink-0 pt-1">
      <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-25em)] text-text-muted mb-3 px-2">Sekcje</p>
      <ul className="space-y-1">
        {SECTIONS.map(({ id, label, href }) => (
          <li key={id}>
            {href ? (
              <Link to={href} className={linkClass(id, activeSection)} aria-current={activeSection === id ? 'page' : undefined}>{label}</Link>
            ) : (
              <a href={`#${id}`} className={linkClass(id, activeSection)} aria-current={activeSection === id ? 'page' : undefined}>{label}</a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
