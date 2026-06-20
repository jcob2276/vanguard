import { Panel } from './Panel';

interface HexagonScores {
  zdrowie: number;
  finanse: number;
  kariera: number;
  relacje: number;
  rozwoj: number;
  duchowosc: number;
}

interface HexagonPanelProps {
  hexagonScores: HexagonScores;
  setHexagonScores: React.Dispatch<React.SetStateAction<HexagonScores>>;
  saveHexagonScores: () => void;
  savingHexagon: boolean;
  theme: string;
  grid: string;
}

export default function HexagonPanel({ hexagonScores, setHexagonScores, saveHexagonScores, savingHexagon, theme, grid }: HexagonPanelProps) {
  return (
    <Panel title="Heksagon Życia — Koło sfer życia (Morita)">
      <div className="grid grid-cols-[1fr_380px] gap-8 items-center p-2">
        {/* Left: SVG Hexagon Radar Chart */}
        <div className="flex justify-center items-center">
          <svg width={300} height={300} className="overflow-visible">
            {/* Conic Grid lines */}
            {[2, 4, 6, 8, 10].map(k => {
              const points = [0, 1, 2, 3, 4, 5].map(index => {
                const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                const radius = 110;
                const cx = 150;
                const cy = 150;
                const val = k / 10;
                return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
              }).join(' ');
              return (
                <polygon
                  key={k}
                  points={points}
                  fill="none"
                  stroke={grid}
                  strokeWidth="1"
                  strokeDasharray={k === 10 ? "none" : "2,3"}
                />
              );
            })}

            {/* Axis lines */}
            {[0, 1, 2, 3, 4, 5].map(index => {
              const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
              const radius = 110;
              const cx = 150;
              const cy = 150;
              const x = cx + radius * Math.cos(angle);
              const y = cy + radius * Math.sin(angle);
              return (
                <line
                  key={index}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke={grid}
                  strokeWidth="1"
                />
              );
            })}

            {/* Value Polygon */}
            <polygon
              points={[0, 1, 2, 3, 4, 5].map(index => {
                const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
                const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
                const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                const radius = 110;
                const cx = 150;
                const cy = 150;
                const val = score / 10;
                return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
              }).join(' ')}
              fill="rgba(79, 70, 229, 0.2)"
              stroke="rgba(79, 70, 229, 0.85)"
              strokeWidth="2"
            />

            {/* Value dots */}
            {[0, 1, 2, 3, 4, 5].map(index => {
              const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
              const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
              const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
              const radius = 110;
              const cx = 150;
              const cy = 150;
              const val = score / 10;
              const x = cx + radius * val * Math.cos(angle);
              const y = cy + radius * val * Math.sin(angle);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="rgb(79, 70, 229)"
                  stroke={theme === 'dark' ? '#000' : '#fff'}
                  strokeWidth="1.5"
                />
              );
            })}

            {/* Labels */}
            {[
              { label: 'Zdrowie & Ciało', xOffset: 0, yOffset: -15, align: 'middle' },
              { label: 'Finanse & Konto', xOffset: 12, yOffset: 5, align: 'start' },
              { label: 'Kariera & Praca', xOffset: 12, yOffset: 5, align: 'start' },
              { label: 'Relacje', xOffset: 0, yOffset: 15, align: 'middle' },
              { label: 'Rozwój Osobisty', xOffset: -12, yOffset: 5, align: 'end' },
              { label: 'Duchowość & Ja', xOffset: -12, yOffset: 5, align: 'end' },
            ].map((lbl, index) => {
              const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
              const radius = 110;
              const cx = 150;
              const cy = 150;
              const x = cx + (radius + 10) * Math.cos(angle) + lbl.xOffset;
              const y = cy + (radius + 10) * Math.sin(angle) + lbl.yOffset;
              return (
                <text
                  key={index}
                  x={x}
                  y={y}
                  textAnchor={lbl.align as 'start' | 'middle' | 'end'}
                  className="text-[9px] font-black uppercase tracking-wider fill-text-primary"
                >
                  {lbl.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Right: Sliders */}
        <div className="space-y-3.5">
          {[
            { key: 'zdrowie', label: 'Zdrowie & Ciało', desc: 'Stan organizmu, energia, nawyki zdrowotne', color: 'accent-emerald-500' },
            { key: 'finanse', label: 'Finanse & Konto', desc: 'Zarabianie, oszczędności, inwestycje', color: 'accent-amber-500' },
            { key: 'kariera', label: 'Kariera & Praca', desc: 'Cele zawodowe, skuteczność, głęboka praca', color: 'accent-indigo-500' },
            { key: 'relacje', label: 'Relacje', desc: 'Jakość kontaktu z bliskimi, brak samotności', color: 'accent-pink-500' },
            { key: 'rozwoj', label: 'Rozwój Osobisty', desc: 'Nowe umiejętności, 1% lepszy każdego dnia', color: 'accent-sky-500' },
            { key: 'duchowosc', label: 'Duchowość & Czas dla siebie', desc: 'Spokój wewnętrzny, medytacja, obecność', color: 'accent-violet-500' },
          ].map(item => (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-text-primary">{item.label}</span>
                <span className="font-black text-primary font-display">{hexagonScores[item.key as keyof typeof hexagonScores] || 5}/10</span>
              </div>
              <div className="flex gap-3 items-center">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={hexagonScores[item.key as keyof typeof hexagonScores] || 5}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setHexagonScores(prev => ({ ...prev, [item.key]: val }));
                  }}
                  className={`w-full h-1 bg-border-custom rounded-lg appearance-none cursor-pointer ${item.color}`}
                />
              </div>
            </div>
          ))}

          <div className="pt-2">
            <button
              onClick={saveHexagonScores}
              disabled={savingHexagon}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingHexagon ? 'Zapisywanie...' : 'Zapisz oceny sfer życia 🎯'}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
