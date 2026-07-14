import { Pressable } from '../ui/ControlPrimitives';
import { useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ClarificationRequestCard } from './ClarificationRequestCard';
import { OracleChat } from './OracleChat';
import { OracleInputPanel } from './OracleInputPanel';
import { useOracleChat } from './useOracleChat';
import { Card } from '../ui/Card';

const MEDICAL_PROMPTS = [
  'Co warto badać / odświeżyć teraz — max 3 priorytety z moich danych',
  'Czego nie robić teraz (overtesting)?',
  'Co ma największe przełożenie operacyjne u mnie?',
];

export type OracleCardProps = {
  embedded?: boolean;
  defaultOpen?: boolean;
  initialQuery?: string;
  storageScope?: 'default' | 'medical';
  suggestedPrompts?: string[];
  emptyHint?: string;
  collapsedTitle?: string;
  collapsedSubtitle?: string;
};

const PROMPTS_BY_MODE: Record<string, string[]> = {
  rescue: [
    'Jestem w trybie ratunkowym — co jest teraz najważniejsze?',
    'Skróć mój plan do 1 działania na dziś',
    'Co odcinam żeby przeżyć ten tydzień?',
    'Jak odblokować energię kiedy wszystko się wali?',
  ],
  minimal: [
    'Co zrobić żeby ten dzień był wygrany przy minimalnej energii?',
    'Jaki jest mój najważniejszy ruch przy niskiej energii?',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
  default: [
    'Jaki powinien być mój fokus dziś?',
    'Oceń mój tydzień i powiedz co poprawić',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
};

export default function OracleCard({
  embedded = false,
  defaultOpen = false,
  initialQuery = '',
  storageScope = 'default',
  suggestedPrompts,
  emptyHint,
  collapsedTitle = 'Zapytaj o swój stan',
  collapsedSubtitle,
}: OracleCardProps) {
  const [open, setOpen] = useState(defaultOpen || embedded);
  const [btnPressed, setBtnPressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    items,
    input,
    setInput,
    loading,
    currentMode,
    pendingClarification,
    setPendingClarification,
    pendingImages,
    setPendingImages,
    previewUrls,
    focused,
    setFocused,
    handleAttachImage,
    handlePendingAction,
    loadClarification,
    ask,
  } = useOracleChat({
    storageScope,
    initialQuery,
    defaultOpen,
    embedded,
    setOpen,
    messagesEndRef,
    inputRef,
  });

  const handleOpen = () => {
    setBtnPressed(true);
    setTimeout(() => {
      setBtnPressed(false);
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    }, 150);
  };

  const promptSuggestions =
    suggestedPrompts ??
    (storageScope === 'medical'
      ? MEDICAL_PROMPTS
      : (PROMPTS_BY_MODE[currentMode] ?? PROMPTS_BY_MODE.default));
  const emptyStateHint =
    emptyHint ??
    (storageScope === 'medical'
      ? 'Kontekst laboratoryjny + pełny state_vector. Priorytetyzacja retestów — bez diagnozy.'
      : 'Oracle ma dostęp do Twoich danych z ostatnich 48h.');

  return (
    <>
      {!open && !embedded ? (
        <Pressable
          onClick={handleOpen}
          style={{ transform: btnPressed ? 'scale(0.9)' : 'scale(1)', transition: 'var(--legacy-inline-style-090)' }}
          className="flex w-full items-center gap-3 rounded-[var(--radius-xl)] border border-primary/10 bg-primary/[0.04] p-4 text-left hover:bg-primary/[0.08] cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-primary/60">Oracle</p>
            <p className="text-sm font-black text-text-primary mt-0.5">{collapsedTitle}</p>
            {collapsedSubtitle && (
              <p className="text-xs text-text-muted mt-0.5">{collapsedSubtitle}</p>
            )}
          </div>
        </Pressable>
      ) : open ? (
        <Card
          as="section"
          variant="glass"
          padding="0"
          className="border border-primary/15 backdrop-blur-[var(--blur-md)]"
          style={{
            animation: 'var(--legacy-inline-style-001)',
            transition: focused ? 'var(--motion-oracle-focus)' : 'var(--motion-oracle-idle)',
          }}
        >
          <style>{`
            @keyframes oracle-slide-up {
              from { opacity:var(--legacy-inline-css-034); transform: translateY(24px) scale(0.97); }
              to   { opacity:var(--legacy-inline-css-035); transform: translateY(0) scale(1); }
            }
          `}</style>

          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-custom">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-primary">
                {storageScope === 'medical' ? 'Oracle · Badania' : 'Oracle'}
              </span>
            </div>
            {!embedded && (
              <Pressable
                onClick={() => setOpen(false)}
                className="rounded-full p-2.5 min-h-[var(--legacy-h-030)] min-w-[var(--legacy-w-088)] flex items-center justify-center text-text-muted hover:bg-surface-solid hover:text-text-primary transition-all cursor-pointer"
              >
                <X size={14} />
              </Pressable>
            )}
          </div>

          <OracleChat
            items={items}
            loading={loading}
            emptyStateHint={emptyStateHint}
            promptSuggestions={promptSuggestions}
            messagesEndRef={messagesEndRef}
            onSuggestionClick={(q) => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
            onPendingAction={handlePendingAction}
          />

          {pendingClarification && (
            <div className="px-4 pt-3">
              <ClarificationRequestCard
                request={pendingClarification}
                onAnswered={() => { setPendingClarification(null); void loadClarification(); }}
              />
            </div>
          )}

          <OracleInputPanel
            input={input}
            setInput={setInput}
            loading={loading}
            setFocused={setFocused}
            storageScope={storageScope}
            pendingImages={pendingImages}
            setPendingImages={setPendingImages}
            previewUrls={previewUrls}
            fileInputRef={fileInputRef}
            inputRef={inputRef}
            onAttachImage={handleAttachImage}
            onSubmit={() => void ask()}
          />
        </Card>
      ) : null}
    </>
  );
}
