import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccentColor = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
export type BubbleStyle = 'imessage' | 'pill' | 'card';
export type BgMode = 'amoled' | 'dark' | 'light';
export type ChannelId = 'oracle' | 'friction' | 'food' | 'todo';

interface ChatThemeState {
  accentColor: AccentColor;
  bubbleStyle: BubbleStyle;
  bgMode: BgMode;
  activeChannel: ChannelId;
  searchQuery: string;
  setAccentColor: (accent: AccentColor) => void;
  setBubbleStyle: (style: BubbleStyle) => void;
  setBgMode: (bg: BgMode) => void;
  setActiveChannel: (channel: ChannelId) => void;
  setSearchQuery: (query: string) => void;
}

export const useChatThemeStore = create<ChatThemeState>()(
  persist(
    (set) => ({
      accentColor: 'blue',
      bubbleStyle: 'imessage',
      bgMode: 'dark',
      activeChannel: 'oracle',
      searchQuery: '',
      setAccentColor: (accentColor) => set({ accentColor }),
      setBubbleStyle: (bubbleStyle) => set({ bubbleStyle }),
      setBgMode: (bgMode) => set({ bgMode }),
      setActiveChannel: (activeChannel) => set({ activeChannel }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'vanguard-chat-theme-storage',
    }
  )
);
