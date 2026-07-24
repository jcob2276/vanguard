import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Bot, Zap, Utensils, CheckSquare, Settings } from 'lucide-react';
import { useChatThemeStore, type ChannelId } from '../../store/useChatThemeStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const CHANNELS: { id: ChannelId; name: string; desc: string; icon: React.ElementType; badge?: string }[] = [
  { id: 'oracle', name: 'Oracle Engine', desc: 'Asystent AI & RAG', icon: Bot, badge: 'AI' },
  { id: 'friction', name: 'Tarcie & Recovery', desc: 'Przeszkody i odzyskanie', icon: Zap },
  { id: 'food', name: 'Posiłki & Makro', desc: 'Logi żywieniowe', icon: Utensils },
  { id: 'todo', name: 'Power Lista', desc: 'Wykonanie zadań', icon: CheckSquare },
];

export default function ChatSidebarDrawer({ open, onClose, onOpenSettings }: Props) {
  const { activeChannel, searchQuery, setActiveChannel, setSearchQuery } = useChatThemeStore();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative z-10 w-72 sm:w-80 h-full bg-card border-r border-border/80 p-4 flex flex-col space-y-4 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Bot className="w-5 h-5 text-primary" />
                <span>Vanguard Channels</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj w strumieniu..."
                className="w-full bg-muted/40 border border-border/60 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              />
            </div>

            {/* Channels List */}
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 block mb-1">
                Kanały i Strumienie
              </span>

              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const isActive = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setActiveChannel(ch.id);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${
                      isActive
                        ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                        : 'bg-muted/20 border-border/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs truncate">{ch.name}</span>
                        {ch.badge && (
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                            {ch.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-75 truncate mt-0.5">{ch.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer / Personalization Entry */}
            <div className="pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-colors"
              >
                <Settings className="w-4 h-4 text-primary" />
                <span>Ustawienia & Motywy (QUIK)</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
