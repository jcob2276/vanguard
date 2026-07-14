import { useLocation } from 'react-router-dom';

export function useActiveSection(sectionIds: string[]): string | null {
  const location = useLocation();

  // Check pathname first (for route-based sections like /korelacje)
  const pathMatch = sectionIds.find(id => location.pathname.includes(id));
  if (pathMatch) return pathMatch;

  // Then check hash
  const hash = location.hash.replace('#', '');
  if (hash && sectionIds.includes(hash)) return hash;

  // Default to first section
  return sectionIds[0] ?? null;
}
