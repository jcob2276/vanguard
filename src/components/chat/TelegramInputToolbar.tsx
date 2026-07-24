import React from 'react';
import { Send, Mic, MicOff, Paperclip } from 'lucide-react';

interface Props {
  input: string;
  loading: boolean;
  recording: boolean;
  recordingTime: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenFilePicker: () => void;
}

export default function TelegramInputToolbar({
  input,
  loading,
  recording,
  recordingTime,
  inputRef,
  onInputChange,
  onSend,
  onStartRecording,
  onStopRecording,
  onOpenFilePicker,
}: Props) {
  return (
    <div className="px-3 py-2 bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-black/5 dark:border-white/10 flex items-center gap-2 font-sans shadow-lg z-30">
      {/* Text Input */}
      {recording ? (
        <div className="flex-1 px-4 py-2 bg-[#FF3B30]/10 rounded-full text-xs font-semibold text-[#FF3B30] flex items-center justify-between border border-[#FF3B30]/30">
          <span>Nagrywanie...</span>
          <span className="font-mono text-xs">{recordingTime}s</span>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Napisz wiadomość"
          className="flex-1 bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm placeholder:text-gray-400 focus:outline-none px-2"
        />
      )}

      {/* Paperclip File Input */}
      <button
        type="button"
        onClick={onOpenFilePicker}
        className="text-gray-400 hover:text-[#20B2AA] transition-colors p-1 shrink-0"
        title="Załącz plik"
      >
        <Paperclip className="w-5.5 h-5.5" />
      </button>

      {/* Right Teal Mic / Send Button */}
      <button
        type="button"
        onClick={recording ? onStopRecording : input.trim() ? onSend : onStartRecording}
        disabled={loading}
        className={`w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all shrink-0 shadow-xs ${
          recording
            ? 'bg-[#FF3B30] text-white animate-pulse'
            : 'bg-[#20B2AA] text-white hover:opacity-90'
        }`}
      >
        {recording ? <MicOff className="w-5 h-5" /> : input.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    </div>
  );
}
