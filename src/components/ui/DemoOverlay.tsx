import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

export interface SpotlightStep {
  targetId?: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'center';
}

interface DemoOverlayProps {
  steps: SpotlightStep[];
  onComplete: () => void;
  onSkip?: () => void;
}

export function DemoOverlay({ steps, onComplete, onSkip }: DemoOverlayProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const advance = () => {
    if (isLast) onComplete();
    else setStep(s => s + 1);
  };

  // Resolve target rect for cutout
  const [targetRect] = useState<DOMRect | null>(() => {
    if (!current?.targetId) return null;
    return document.getElementById(current.targetId)?.getBoundingClientRect() ?? null;
  });

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
      {/* Scrim with optional cutout */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x - 8}
                y={targetRect.y - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Tooltip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[88%] max-w-sm rounded-2xl p-5 space-y-3"
        style={{
          bottom: current.placement === 'top' ? 'auto' : current.placement === 'center' ? '50%' : '8vh',
          top: current.placement === 'top' ? '10vh' : undefined,
          transform: current.placement === 'center' ? 'translateX(-50%) translateY(50%)' : 'translateX(-50%)',
          background: 'white',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 10000,
        }}
      >
        {/* Step dots */}
        <div className="flex gap-1 justify-center">
          {steps.map((_, i) => (
            <div key={i} className="h-1 rounded-full transition-all" style={{ width: i === step ? 16 : 6, background: i === step ? '#5B6CFF' : 'rgba(153,161,175,0.3)' }} />
          ))}
        </div>

        <p className="text-[15px] font-[800]" style={{ color: 'var(--text-primary, #0A0A0A)' }}>{current.title}</p>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary, #6B7280)' }}>{current.body}</p>

        <div className="flex items-center gap-2 pt-1">
          {onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: 'var(--color-text-tertiary, #99A1AF)' }}
            >
              <X size={11} /> Pomiń
            </button>
          )}
          <button
            onClick={advance}
            className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-white transition-all active:scale-95"
            style={{ background: '#5B6CFF' }}
          >
            {isLast ? 'Gotowe' : 'Dalej'}
            {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Persist onboarding state in localStorage */
const ONBOARDING_KEY = 'vanguard_onboarding_done';
export function isOnboardingDone(): boolean {
  try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return true; }
}
export function markOnboardingDone(): void {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
}
