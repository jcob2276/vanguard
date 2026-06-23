interface HeroCardProps {
  title: string;
  description?: string;
  startTime?: string;
  priority?: number;
}

export function HeroCard({ title, description, startTime }: HeroCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] flex flex-col justify-end p-5"
      style={{
        background: 'linear-gradient(135deg, #172554, #0F766E)',
        minHeight: 188,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

      <div className="relative z-10 space-y-2">
        <span
          className="inline-block text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '4px 10px',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          Wyróżnione
        </span>

        {startTime && (
          <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{startTime}</p>
        )}

        <p className="text-[21px] font-[700] leading-[1.2]" style={{ color: 'white' }}>{title}</p>

        {description && (
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{description}</p>
        )}
      </div>
    </div>
  );
}
