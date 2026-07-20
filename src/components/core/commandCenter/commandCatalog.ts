import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Calendar,
  CheckSquare,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  Redo2,
  Undo2,
} from 'lucide-react';
import { redoLastAction, undoLastAction } from '../../../lib/actionHistory';

export interface VanguardCommand {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => Promise<unknown> | unknown;
}

interface CommandCatalogOptions {
  navigate: (path: string) => void;
  close: () => void;
}

export function createCommandCatalog({ navigate, close }: CommandCatalogOptions): VanguardCommand[] {
  const go = (path: string) => () => {
    navigate(path);
    close();
  };

  return [
    { id: 'today', title: 'Otwórz Dzisiaj', subtitle: 'Plan, Teraz i następne ruchy', keywords: 'dzisiaj dziś home plan teraz', icon: LayoutDashboard, run: go('/dzis') },
    { id: 'tasks', title: 'Otwórz Zadania', subtitle: 'Skrzynka, Dzisiaj i zaplanowane', keywords: 'todo zadania lista skrzynka', icon: CheckSquare, run: go('/todo') },
    { id: 'notes', title: 'Otwórz Notatki', subtitle: 'Notatki, materiały i powiązania', keywords: 'keep notes notatki wiedza', icon: FileText, run: go('/keep') },
    { id: 'calendar', title: 'Otwórz Kalendarz', subtitle: 'Dzień, tydzień i agenda', keywords: 'kalendarz wydarzenia event plan', icon: Calendar, run: go('/kalendarz') },
    { id: 'terminy', title: 'Otwórz Terminy', subtitle: 'Urodziny, przeglądy, polisy', keywords: 'terminy urodziny przegląd polisa ubezpieczenie przypomnienia', icon: Bell, run: go('/terminy') },
    { id: 'inbox', title: 'Otwórz Pocket', subtitle: 'Materiały oczekujące na decyzję', keywords: 'pocket inbox linki skrzynka materiały', icon: Inbox, run: go('/links') },
    { id: 'history', title: 'Otwórz Historię', subtitle: 'Refleksje i wcześniejsze dni', keywords: 'historia refleksje dni', icon: History, run: go('/historia') },
    { id: 'undo', title: 'Cofnij ostatnią zmianę', subtitle: 'Ostatnia odwracalna czynność', keywords: 'undo cofnij wróć zmiana', icon: Undo2, shortcut: '⌘ Z', run: undoLastAction },
    { id: 'redo', title: 'Ponów ostatnią zmianę', subtitle: 'Ponownie wykonaj cofniętą czynność', keywords: 'redo ponów powtórz', icon: Redo2, shortcut: '⇧⌘ Z', run: redoLastAction },
  ];
}

export function filterCommands(commands: VanguardCommand[], query: string): VanguardCommand[] {
  const normalized = query.trim().toLocaleLowerCase('pl-PL');
  if (!normalized) return commands.slice(0, 6);
  const words = normalized.split(/\s+/);
  return commands.filter((command) => {
    const haystack = `${command.title} ${command.subtitle} ${command.keywords}`.toLocaleLowerCase('pl-PL');
    return words.every((word) => haystack.includes(word));
  });
}
