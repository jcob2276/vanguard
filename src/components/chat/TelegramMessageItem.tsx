import React from 'react';
import { Check, CheckCheck, Copy, Trash2, Play, Pause, Bot } from 'lucide-react';
import type { ChatMessage } from '../../lib/chatApi';

interface Props {
  message: ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export default function TelegramMessageItem({ message, copiedId, onCopy, onDelete }: Props) {
  const isUser = message.role === 'user';
  const isVoice = message.content.toLowerCase().includes('notatka głosowa') || message.content.toLowerCase().includes('[audio');
  const [isPlayingVoice, setIsPlayingVoice] = React.useState(false);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} my-1`}>
      <div
        className={`group relative max-w-[88%] sm:max-w-[82%] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed transition-all ${
          isUser
            ? 'bg-[#EEF7E8] text-[#1B320B] rounded-2xl rounded-tr-xs shadow-2xs border border-[#D6ECCB]'
            : 'bg-white/95 text-gray-900 rounded-2xl rounded-tl-xs shadow-xs border border-white/20'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3894F6] mb-1">
            <Bot className="w-3.5 h-3.5" />
            <span>Digital Twin (bot)</span>
          </div>
        )}

        {/* Voice Note Waveform Render */}
        {isVoice ? (
          <div className="flex items-center gap-3 py-1 px-1">
            <button
              type="button"
              onClick={() => setIsPlayingVoice(!isPlayingVoice)}
              className="w-8 h-8 rounded-full bg-[#3894F6] text-white flex items-center justify-center shrink-0 hover:bg-[#2080E5] transition-colors shadow-xs"
            >
              {isPlayingVoice ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-0.5 h-5">
                {[40, 75, 30, 90, 60, 100, 45, 80, 50, 95, 35, 70, 85, 40, 65, 30, 80, 55].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-0.5 rounded-full transition-all ${
                      isPlayingVoice ? 'bg-[#3894F6] animate-pulse' : 'bg-gray-400/60'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-gray-500 font-mono block">0:14 • Notatka głosowa</span>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap select-text leading-snug">{message.content}</p>
        )}

        {/* Telegram Time & Checkmarks Badge */}
        <div className="flex items-center justify-end gap-1 mt-1 pt-0.5 text-[10px] text-gray-400 font-mono">
          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

          {isUser && (
            <span className="text-[#4CAF50]" title="Dostarczono i przeczytano">
              <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
          )}

          {/* Action menu on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-xs text-white">
            <button type="button" onClick={() => onCopy(message.id, message.content)} className="p-0.5 hover:text-white" title="Kopiuj">
              {copiedId === message.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button type="button" onClick={() => onDelete(message.id)} className="p-0.5 hover:text-red-400" title="Usuń">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
