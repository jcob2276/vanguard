import Button from '../ui/Button';
import type { RefObject } from 'react';
import {
  ChatItem,
  TimeDivider,
  ThinkingItem,
  ToolCallItem,
  AiMessageItem,
  UserMessageItem,
  ErrorItem,
  SystemReminderItem,
  shouldShowTimeDivider,
} from './ChatItems';

interface OracleChatProps {
  items: ChatItem[];
  loading: boolean;
  emptyStateHint: string;
  promptSuggestions: string[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSuggestionClick: (suggestion: string) => void;
  onPendingAction: (itemId: number, actionId: string, actionType: string, payload: unknown, approved: boolean) => void;
}

export function OracleChat({
  items,
  loading,
  emptyStateHint,
  promptSuggestions,
  messagesEndRef,
  onSuggestionClick,
  onPendingAction,
}: OracleChatProps) {
  return (
    <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
      {items.length === 0 && (
        <div className="py-2 space-y-2">
          <p className="text-xs text-text-muted text-center mb-3">{emptyStateHint}</p>
          {promptSuggestions.map((q) => (
            <Button
              key={q}
              variant="ghost"
              onClick={() => onSuggestionClick(q)}
              className="w-full justify-start text-left rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-primary/20 hover:bg-surface-solid"
            >
              {q}
            </Button>
          ))}
        </div>
      )}
      {items.map((item, i) => {
        const prev = items[i - 1];
        const showDivider = prev && shouldShowTimeDivider(prev, item);
        return (
          <div key={i}>
            {showDivider && <TimeDivider date={item.timestamp} />}
            {item.type === 'user' && <UserMessageItem text={item.text} />}
            {item.type === 'ai' && (
              <AiMessageItem
                text={item.text}
                reasoning={item.reasoning}
                templateId={item.templateId}
                cardData={item.cardData}
              />
            )}
            {item.type === 'thinking' && <ThinkingItem item={item} />}
            {item.type === 'tool' && <ToolCallItem item={item} />}
            {item.type === 'error' && <ErrorItem text={item.text} />}
            {item.type === 'action' && (
              <div className="space-y-2 my-2 p-3 rounded-xl border border-primary/25 bg-primary/5">
                <p className="text-xs font-bold text-primary">{item.text}</p>
                {item.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onPendingAction(i, item.pendingActionId ?? '', item.pendingActionType ?? '', item.pendingActionPayload, true)}
                      className="rounded-lg"
                    >
                      Zatwierdź
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPendingAction(i, item.pendingActionId ?? '', item.pendingActionType ?? '', item.pendingActionPayload, false)}
                      className="rounded-lg bg-surface border border-border-custom text-text-secondary hover:bg-surface-solid hover:text-text-secondary"
                    >
                      Odrzuć
                    </Button>
                  </div>
                )}
              </div>
            )}
            {item.type === 'system_reminder' && <SystemReminderItem text={item.text} />}
          </div>
        );
      })}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-sm border border-border-custom bg-surface-solid px-4 py-2.5">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
