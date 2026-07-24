import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MoreVertical, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchChatMessages, sendOracleMessage, captureEntry, deleteChatMessage, type ChatMessage } from '../../lib/chatApi';
import { notify, confirmDialog } from '../../lib/notify';
import { triggerHaptic } from '../../lib/native/haptics';
import FoodQuickCapture from '../core/nutrition/FoodQuickCapture';
import ChatThemeModal from './ChatThemeModal';
import TelegramMessageItem from './TelegramMessageItem';
import TelegramInlineKeyboard from './TelegramInlineKeyboard';
import TelegramBottomKeyboard from './TelegramBottomKeyboard';
import TelegramInputToolbar from './TelegramInputToolbar';

export default function CzatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFoodCard, setShowFoodCard] = useState(false);
  const [showMoreKeyboard, setShowMoreKeyboard] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatMessages().then(setMessages).catch(() => notify('Błąd pobierania historii czatu', 'error'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, showFoodCard]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;
    if (!customText) setInput('');
    void triggerHaptic();

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { responseText } = await sendOracleMessage(textToSend);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: responseText, created_at: new Date().toISOString() }]);
    } catch {
      notify('Błąd komunikacji z Oracle', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBottomAction = (text: string) => {
    void triggerHaptic();
    if (text === 'Koniec dnia' || text === 'Wywiad') {
      handleSend(text);
    } else {
      setInput(text);
      textInputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (id: string) => {
    void triggerHaptic();
    const ok = await confirmDialog('Usuń tę wiadomość z bazy danych?');
    if (!ok) return;
    const success = await deleteChatMessage(id);
    if (success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      notify('Wiadomość usunięta z bazy', 'info');
    } else {
      notify('Błąd usuwania wiadomości', 'error');
    }
  };

  const startRecording = async () => {
    void triggerHaptic();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setLoading(true);
        try {
          const res = await captureEntry({ audioBlob, source: 'czat_view_voice' });
          if (res.message) { setInput(res.message); notify('Notatka głosowa przetworzona', 'success'); }
        } catch { notify('Błąd transkrypcji', 'error'); } finally { setLoading(false); }
      };
      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { notify('Brak dostępu do mikrofonu', 'error'); }
  };

  const stopRecording = () => {
    void triggerHaptic();
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop')`,
      }}
      className="flex flex-col h-[calc(100dvh-4.25rem)] max-w-2xl mx-auto bg-cover bg-center font-sans text-gray-900 overflow-hidden relative"
    >
      {/* Translucent Backdrop Overlay */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
          await captureEntry({ content: `[Zdjęcie: ${file.name}]`, source: 'camera_ocr' });
          notify('Zdjęcie przetworzone', 'success');
        } catch { notify('Błąd ze zdjęciem', 'error'); } finally { setLoading(false); }
      }} accept="image/*" className="hidden" />

      <ChatThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />

      {/* Telegram Header */}
      <div className="relative z-10 px-3 py-2 bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-black/5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="p-1 rounded-full text-gray-700 dark:text-gray-200 hover:bg-black/5">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3894F6] to-[#007AFF] flex items-center justify-center text-white text-sm font-bold shadow-xs">
            DT
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-gray-900 dark:text-white">Digital Twin</h1>
            <span className="text-[11px] text-gray-500 font-normal">bot</span>
          </div>
        </div>

        <button type="button" onClick={() => setThemeOpen(true)} className="p-1.5 rounded-full text-gray-700 dark:text-gray-200 hover:bg-black/5">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <div className="flex justify-center my-2">
          <span className="bg-[#3894F6] text-white text-xs px-3.5 py-1 rounded-full font-medium shadow-xs">
            24 lipca
          </span>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <TelegramMessageItem
              key={msg.id}
              message={msg}
              copiedId={copiedId}
              onCopy={(id, text) => { void triggerHaptic(); navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }}
              onDelete={handleDeleteMessage}
            />
          ))}
        </AnimatePresence>

        <TelegramInlineKeyboard onSelectAction={(text) => handleSend(text)} />

        {showFoodCard && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="my-2">
            <FoodQuickCapture onSaved={() => { notify('Posiłek zapisany!', 'success'); setShowFoodCard(false); }} />
          </motion.div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-700 px-3.5 py-2 bg-white/90 rounded-2xl w-fit shadow-xs border border-black/5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3894F6]" />
            <span>pisze...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Controls Area */}
      <div className="relative z-10">
        <TelegramInputToolbar
          input={input}
          loading={loading}
          recording={recording}
          recordingTime={recordingTime}
          inputRef={textInputRef}
          onInputChange={setInput}
          onSend={() => handleSend()}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onOpenFilePicker={() => fileInputRef.current?.click()}
        />

        <TelegramBottomKeyboard
          onSelectAction={handleSelectBottomAction}
          onToggleFood={() => setShowFoodCard((prev) => !prev)}
          onToggleMore={() => setShowMoreKeyboard((prev) => !prev)}
          showMore={showMoreKeyboard}
          showFoodCard={showFoodCard}
        />
      </div>
    </div>
  );
}
