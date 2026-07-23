import { useEffect, useRef } from 'react';

export type ThinkingOrbState = 'idle' | 'thinking' | 'working' | 'solving' | 'searching' | 'listening';
type ThinkingOrbSize = 'sm' | 'md' | 'lg';

export interface ThinkingOrbProps {
  /** Animated orb state. Default 'thinking' */
  state?: ThinkingOrbState;
  /** Size preset or numeric pixel value. 'sm' = 24, 'md' = 40, 'lg' = 64. Default 'md' */
  size?: ThinkingOrbSize | number;
  /** Color theme. Default 'auto' */
  theme?: 'dark' | 'light' | 'auto';
  /** Extra CSS classes */
  className?: string;
  /** Label for accessibility */
  ariaLabel?: string;
}
const SIZE_MAP: Record<ThinkingOrbSize, number> = {
  sm: 24,
  md: 40,
  lg: 64,
};

const canvasColor = (channels: string, alpha: number) => `rgba${`(${channels}, ${alpha})`}`;

export function ThinkingOrb({
  state = 'thinking',
  size = 'md',
  theme = 'auto',
  className = '',
  ariaLabel,
}: ThinkingOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pxSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 40;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const startTime = performance.now();

    const dpr = window.devicePixelRatio || 1;
    canvas.width = pxSize * dpr;
    canvas.height = pxSize * dpr;
    ctx.scale(dpr, dpr);

    const isDark =
      theme === 'dark' ||
      (theme === 'auto' && document.documentElement.classList.contains('dark'));

    const baseColor = isDark ? '255, 255, 255' : '15, 23, 42';
    const accentColor = isDark ? '56, 189, 248' : '14, 165, 233'; // primary sky/cyan glow

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      ctx.clearRect(0, 0, pxSize, pxSize);

      const center = pxSize / 2;
      const baseRadius = pxSize * 0.35;
      const dotCount = 12;

      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2;
        let r = baseRadius;
        let dotSize = Math.max(1.2, pxSize * 0.05);
        let alpha = 0.8;
        let x = 0;
        let y = 0;

        switch (state) {
          case 'idle': {
            const rot = elapsed * 0.8 + angle;
            x = center + Math.cos(rot) * r;
            y = center + Math.sin(rot) * r;
            alpha = 0.4 + 0.3 * Math.sin(rot * 2);
            break;
          }

          case 'thinking': {
            const speed = 2.2;
            const rot = elapsed * speed + angle;
            const pulse = Math.sin(elapsed * 4 + i * 0.5) * (pxSize * 0.08);
            r = baseRadius + pulse;
            x = center + Math.cos(rot) * r;
            y = center + Math.sin(rot) * r;
            dotSize += Math.sin(elapsed * 6 + i) * 0.6;
            alpha = 0.5 + 0.5 * Math.sin(rot * 3);
            break;
          }

          case 'working': {
            const speed = 3.5;
            const rot = elapsed * speed + angle;
            const jitter = Math.sin(elapsed * 15 + i * 3) * (pxSize * 0.03);
            r = baseRadius + jitter;
            x = center + Math.cos(rot) * r;
            y = center + Math.sin(rot) * r;
            alpha = 0.6 + 0.4 * Math.cos(rot * 4);
            break;
          }

          case 'solving': {
            const rot = elapsed * 1.5 + (i % 4) * (Math.PI / 2);
            const morph = Math.sin(elapsed * 3) * 0.3 + 0.7;
            x = center + Math.cos(rot) * r * morph;
            y = center + Math.sin(rot) * r * (2 - morph);
            alpha = 0.7 + 0.3 * Math.sin(elapsed * 5 + i);
            break;
          }

          case 'searching': {
            const wave = Math.sin(elapsed * 4 - i * 0.4);
            r = baseRadius * (0.6 + 0.6 * Math.abs(wave));
            const rot = elapsed * 1.2 + angle;
            x = center + Math.cos(rot) * r;
            y = center + Math.sin(rot) * r;
            alpha = Math.max(0.2, 1 - r / (pxSize * 0.45));
            break;
          }

          case 'listening': {
            const rot = angle;
            const audioWave = Math.abs(Math.sin(elapsed * 8 + i * 1.2)) * (pxSize * 0.15);
            r = baseRadius + audioWave;
            x = center + Math.cos(rot) * r;
            y = center + Math.sin(rot) * r;
            alpha = 0.5 + 0.5 * Math.sin(elapsed * 8 + i);
            break;
          }
        }

        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.8, dotSize), 0, Math.PI * 2);
        const isAccentDot = i % 3 === 0;
        ctx.fillStyle = isAccentDot
          ? canvasColor(accentColor, alpha)
          : canvasColor(baseColor, alpha);
        ctx.shadowBlur = isAccentDot ? 6 : 0;
        ctx.shadowColor = canvasColor(accentColor, 0.6);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, pxSize, theme]);

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: pxSize, height: pxSize }}
      role="status"
      aria-label={ariaLabel ?? `Wskaźnik AI: ${state}`}
    >
      <canvas ref={canvasRef} style={{ width: pxSize, height: pxSize }} />
    </div>
  );
}
