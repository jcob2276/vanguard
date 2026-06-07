export function TrendArrow({ current, previous, better = 'up' }) {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="ml-1 text-neutral-500">â†’</span>;

  const isImproving = better === 'up' ? diff > 0 : diff < 0;

  return (
    <span className={`ml-1 font-black ${isImproving ? 'text-dayC' : 'text-dayB'}`}>
      {diff > 0 ? 'â†‘' : 'â†“'}
    </span>
  );
}
