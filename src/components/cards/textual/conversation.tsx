interface Message { speaker: string; text: string; isUser?: boolean; }
interface ConversationData { messages: Message[]; title?: string; }
export function ConversationCard({ data }: { data: ConversationData }) {
  return (
    <div className="space-y-2">
      {data.title && <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{data.title}</p>}
      {data.messages.map((m, i) => (
        <div key={i} className={`flex ${m.isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
          <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: m.isUser ? '#5B6CFF' : 'rgba(153,161,175,0.2)', color: m.isUser ? 'white' : 'var(--color-text-tertiary)' }}>{m.speaker[0]}</div>
          <div className="max-w-[80%]">
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{m.speaker}</p>
            <p className="text-[12px] rounded-xl px-2.5 py-1.5" style={{ background: m.isUser ? 'rgba(91,108,255,0.08)' : 'rgba(153,161,175,0.08)', color: 'var(--text-secondary)' }}>{m.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
