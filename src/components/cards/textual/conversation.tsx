interface Message { speaker: string; text: string; isUser?: boolean; }
interface ConversationData { messages: Message[]; title?: string; }
export function ConversationCard({ data }: { data: ConversationData }) {
  return (
    <div className="space-y-2">
      {data.title && <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{data.title}</p>}
      {data.messages.map((m, i) => (
        <div key={i} className={`flex ${m.isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
          <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-2xs font-bold" style={{ background: m.isUser ? 'var(--color-primary)' : 'var(--legacy-color-088)', color: m.isUser ? 'white' : 'var(--color-text-tertiary)' }}>{m.speaker[0]}</div>
          <div className="max-w-[var(--legacy-maxw-061)]">
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{m.speaker}</p>
            <p className="text-sm rounded-xl px-2.5 py-1.5" style={{ background: m.isUser ? 'var(--legacy-color-149)' : 'var(--legacy-color-085)', color: 'var(--text-secondary)' }}>{m.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
