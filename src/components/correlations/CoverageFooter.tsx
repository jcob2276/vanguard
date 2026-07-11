interface CoverageFooterProps {
  coverage: Record<string, number>;
}

export default function CoverageFooter({ coverage }: CoverageFooterProps) {
  return (
    <details className="rounded-xl border border-border-custom bg-surface/50 p-3">
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-text-muted">
        Pokrycie danych (90 dni)
      </summary>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(coverage)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => (
            <div key={k} className="text-[10px] flex justify-between gap-2 py-1 border-b border-border-custom/40">
              <span className="text-text-muted truncate">{k}</span>
              <span className="font-bold text-text-primary shrink-0">{n}d</span>
            </div>
          ))}
      </div>
    </details>
  );
}
