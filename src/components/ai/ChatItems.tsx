import React, { useState, useEffect } from 'react';
import { Brain, Terminal, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

export type ToolItem = {
  name: string;
  args: string;
  result?: string;
  isError?: boolean;
  duration?: number;
};

export type ChatItem =
  | { type: 'user'; text: string; timestamp: Date }
  | { type: 'ai'; text: string; timestamp: Date; isStreaming?: boolean; templateId?: string; cardData?: unknown }
  | { type: 'thinking'; text: string; timestamp: Date; isFinished: boolean }
  | { type: 'tool'; name: string; args: string; result?: string; isError?: boolean; duration?: number; timestamp: Date; children?: ToolItem[] }
  | { type: 'artifact'; title: string; content: string; timestamp: Date }
  | { type: 'error'; text: string; timestamp: Date }
  | { type: 'action'; text: string; timestamp: Date }
  | { type: 'system_reminder'; text: string; timestamp: Date };

function formatTimestamp(date: Date, referenceDate = new Date()): string {
  const diff = referenceDate.getTime() - date.getTime();
  const refDay = new Date(referenceDate);
  refDay.setHours(0, 0, 0, 0);
  const itemDay = new Date(date);
  itemDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((refDay.getTime() - itemDay.getTime()) / 86400000);
  const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 0) return timeStr;
  if (dayDiff === 1) return `Wczoraj ${timeStr}`;
  if (dayDiff < 7) {
    const dayName = date.toLocaleDateString('pl-PL', { weekday: 'short' });
    return `${dayName} ${timeStr}`;
  }
  const sameYear = date.getFullYear() === referenceDate.getFullYear();
  const dateStr = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${dateStr} ${timeStr}`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function shouldShowTimeDivider(prev: ChatItem, current: ChatItem): boolean {
  const diff = current.timestamp.getTime() - prev.timestamp.getTime();
  return diff > 5 * 60 * 1000; // show divider if >5 min apart
}

export function TimeDivider({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 h-px" style={{ background: 'rgba(153,161,175,0.15)' }} />
      <span className="text-[10px] font-medium px-2" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatTimestamp(date)}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(153,161,175,0.15)' }} />
    </div>
  );
}

export function ThinkingItem({ item }: { item: Extract<ChatItem, { type: 'thinking' }> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex justify-start">
      <button
        onClick={() => setExpanded(v => !v)}
        className="max-w-[90%] rounded-2xl rounded-bl-sm border px-3 py-2 text-left transition-all"
        style={{ borderColor: 'rgba(153,161,175,0.2)', background: 'rgba(153,161,175,0.05)' }}
      >
        <div className="flex items-center gap-1.5">
          <Brain size={11} style={{ color: 'var(--color-text-tertiary)' }} />
          <span className="text-[10px] font-medium italic" style={{ color: 'var(--color-text-tertiary)' }}>
            {item.isFinished ? 'Przemyślane' : 'Myślę...'}
          </span>
          {expanded ? <ChevronDown size={10} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={10} style={{ color: 'var(--color-text-tertiary)' }} />}
        </div>
        {expanded && (
          <p className="mt-1.5 text-[11px] italic leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
            {item.text}
          </p>
        )}
      </button>
    </div>
  );
}

export function ToolCallItem({ item }: { item: Extract<ChatItem, { type: 'tool' }> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex justify-start">
      <button
        onClick={() => setExpanded(v => !v)}
        className="max-w-[90%] rounded-2xl rounded-bl-sm border px-3 py-2 text-left transition-all"
        style={{ borderColor: item.isError ? 'rgba(244,63,94,0.2)' : 'rgba(91,108,255,0.15)', background: item.isError ? 'rgba(244,63,94,0.04)' : 'rgba(91,108,255,0.04)' }}
      >
        <div className="flex items-center gap-1.5">
          <Terminal size={11} style={{ color: item.isError ? 'var(--color-danger)' : '#5B6CFF' }} />
          <span className="text-[10px] font-mono font-medium" style={{ color: item.isError ? 'var(--color-danger)' : '#5B6CFF' }}>
            {item.name}
          </span>
          {item.duration != null && (
            <span className="text-[9px] ml-1" style={{ color: 'var(--color-text-tertiary)' }}>{item.duration}ms</span>
          )}
          {expanded ? <ChevronDown size={10} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={10} style={{ color: 'var(--color-text-tertiary)' }} />}
        </div>
        {expanded && (
          <div className="mt-1.5 space-y-1">
            {item.args && (
              <pre className="text-[10px] leading-relaxed whitespace-pre-wrap rounded-lg px-2 py-1 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)' }}>
                {item.args}
              </pre>
            )}
            {item.result && (
              <pre className="text-[10px] leading-relaxed whitespace-pre-wrap rounded-lg px-2 py-1 overflow-x-auto" style={{ background: item.isError ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.06)', color: item.isError ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {item.result}
              </pre>
            )}
          </div>
        )}
      </button>
    </div>
  );
}

export function AiMessageItem({ text, templateId, cardData }: { text: string; templateId?: string; cardData?: unknown }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[12px] leading-relaxed border"
        style={{ background: 'var(--surface-solid)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      >
        {text}
      </div>
      {templateId && cardData !== undefined && (
        <AiCardRenderer templateId={templateId} cardData={cardData} />
      )}
    </div>
  );
}

function AiCardRenderer({ templateId, cardData }: { templateId: string; cardData: unknown }) {
  const [CardFactoryComp, setCardFactoryComp] = useState<React.ComponentType<{ templateId: string; data: unknown }> | null>(null);
  useEffect(() => {
    import('../cards/CardFactory').then(m => {
      const Comp = ({ templateId, data }: { templateId: string; data: unknown }) =>
        m.CardFactory({ templateId: templateId as any, data, title: undefined, tags: undefined });
      setCardFactoryComp(() => Comp);
    });
  }, []);
  if (!CardFactoryComp) return null;
  return <CardFactoryComp templateId={templateId} data={cardData} />;
}

export function UserMessageItem({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[12px] leading-relaxed bg-primary text-white">
        {text}
      </div>
    </div>
  );
}

export function ErrorItem({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[12px] leading-relaxed border"
        style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.04)', color: 'var(--color-danger)' }}>
        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
        {text}
      </div>
    </div>
  );
}

/** Stage direction — centered italic text between chat bubbles (#36) */
export function SendActionMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center my-1">
      <p className="text-[11px] italic px-3" style={{ color: 'var(--color-text-tertiary)' }}>
        * {text} *
      </p>
    </div>
  );
}

/** System reminder injected after N idle turns (#9) */
export function SystemReminderItem({ text }: { text: string }) {
  return (
    <div className="flex justify-center my-2">
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{ background: 'rgba(91,108,255,0.07)', border: '1px solid rgba(91,108,255,0.15)' }}
      >
        <span className="text-[9px]">💡</span>
        <p className="text-[10px] font-medium" style={{ color: '#5B6CFF' }}>{text}</p>
      </div>
    </div>
  );
}
