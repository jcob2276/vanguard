import type { HexagonScores } from './HexagonPanel';

const CHART_LABELS = [
  { label: 'Zdrowie & Ciało', xOffset: 0, yOffset: -15, align: 'middle' },
  { label: 'Finanse & Konto', xOffset: 12, yOffset: 5, align: 'start' },
  { label: 'Kariera & Praca', xOffset: 12, yOffset: 5, align: 'start' },
  { label: 'Relacje', xOffset: 0, yOffset: 15, align: 'middle' },
  { label: 'Rozwój Osobisty', xOffset: -12, yOffset: 5, align: 'end' },
  { label: 'Duchowość & Ja', xOffset: -12, yOffset: 5, align: 'end' },
];

const SCORE_KEYS = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'] as const;

export default function HexagonChart({ scores, theme, grid }: { scores: HexagonScores; theme: string; grid: string }) {
  return (
    <svg width={300} height={300} className="overflow-visible">
      {[2, 4, 6, 8, 10].map((k) => {
        const points = [0, 1, 2, 3, 4, 5]
          .map((index) => {
            const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
            const val = k / 10;
            return `${150 + 110 * val * Math.cos(angle)},${150 + 110 * val * Math.sin(angle)}`;
          })
          .join(' ');
        return (
          <polygon
            key={k}
            points={points}
            fill="none"
            stroke={grid}
            strokeWidth="1"
            strokeDasharray={k === 10 ? 'none' : '2,3'}
          />
        );
      })}

      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const x = 150 + 110 * Math.cos(angle);
        const y = 150 + 110 * Math.sin(angle);
        return <line key={index} x1={150} y1={150} x2={x} y2={y} stroke={grid} strokeWidth="1" />;
      })}

      <polygon
        points={SCORE_KEYS.map((key, index) => {
          const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
          const val = (scores[key] || 5) / 10;
          return `${150 + 110 * val * Math.cos(angle)},${150 + 110 * val * Math.sin(angle)}`;
        }).join(' ')}
        fill="rgba(79, 70, 229, 0.2)"
        stroke="rgba(79, 70, 229, 0.85)"
        strokeWidth="2"
      />

      {SCORE_KEYS.map((key, index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const val = (scores[key] || 5) / 10;
        const x = 150 + 110 * val * Math.cos(angle);
        const y = 150 + 110 * val * Math.sin(angle);
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r="4"
            fill="rgb(79, 70, 229)"
            stroke={theme === 'dark' ? '#000' : '#fff'}
            strokeWidth="1.5"
          />
        );
      })}

      {CHART_LABELS.map((lbl, index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const x = 150 + 120 * Math.cos(angle) + lbl.xOffset;
        const y = 150 + 120 * Math.sin(angle) + lbl.yOffset;
        return (
          <text
            key={lbl.label}
            x={x}
            y={y}
            textAnchor={lbl.align as 'start' | 'middle' | 'end'}
            className="text-2xs font-black uppercase tracking-wider fill-text-primary"
          >
            {lbl.label}
          </text>
        );
      })}
    </svg>
  );
}
