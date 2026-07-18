import { TriangleAlert } from 'lucide-react';

export default function CalendarConflictNotice({ titles }: { titles: string[] }) {
  if (titles.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/8 px-3 py-2.5 text-xs text-warning">
      <TriangleAlert size={15} className="mt-0.5 shrink-0" />
      <p><strong>Ten czas jest już zajęty.</strong> Kolizja z: {titles.slice(0, 2).join(', ')}. Możesz zapisać mimo to.</p>
    </div>
  );
}
