import { useRef } from 'react';
import { Download, Share2 } from 'lucide-react';

interface SharePosterDecoratorProps {
  title: string;
  body: string;
  stat?: string;
  statLabel?: string;
  date?: string;
  gradient?: [string, string];
}

export function SharePosterDecorator({
  title,
  body,
  stat,
  statLabel,
  date,
  gradient = ['#172554', '#0F766E'],
}: SharePosterDecoratorProps) {
  const posterRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!posterRef.current) return;
    // Use html2canvas if available, otherwise fallback to clipboard text
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(posterRef.current, { backgroundColor: null, scale: 2 });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'vanguard.png', { type: 'image/png' })] })) {
          await navigator.share({ files: [new File([blob], 'vanguard.png', { type: 'image/png' })] });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'vanguard-share.png';
          a.click();
        }
      }, 'image/png');
    } catch {
      // Fallback: copy text
      const text = `${title}\n${body}${stat ? `\n${stat} ${statLabel}` : ''}`;
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <div className="space-y-2">
      {/* Poster */}
      <div
        ref={posterRef}
        className="relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between"
        style={{
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          minHeight: 220,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand watermark */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Vangu<span style={{ color: 'rgba(255,255,255,0.85)' }}>a</span>rd
          </span>
        </div>

        {/* Main content */}
        <div className="mt-4 space-y-2">
          {stat && (
            <div className="flex items-end gap-2">
              <span className="text-[36px] font-[900] leading-none" style={{ color: 'white' }}>{stat}</span>
              {statLabel && <span className="text-[12px] font-semibold pb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{statLabel}</span>}
            </div>
          )}
          <p className="text-[16px] font-bold leading-snug" style={{ color: 'white' }}>{title}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{body}</p>
        </div>

        {/* Date */}
        {date && (
          <p className="mt-4 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{date}</p>
        )}

        {/* Decorative corner glow */}
        <div
          className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      </div>

      {/* Share/Download button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition-all active:scale-95"
        style={{ background: 'rgba(91,108,255,0.08)', color: '#5B6CFF', border: '1px solid rgba(91,108,255,0.15)' }}
      >
        <Share2 size={13} />
        Udostępnij poster
      </button>
    </div>
  );
}
