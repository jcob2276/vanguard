import { Bookmark, CheckCircle2, Folder, Sparkles } from 'lucide-react';
import type { VanguardCommand } from './commandCatalog';

export interface SearchResults {
  graph: Array<{ source_entity: string; relation: string; target_entity: string; fact_text: string | null }>;
  todos: Array<{ id: string; title: string; status: string; notes: string | null }>;
  projects: Array<{ id: string; name: string; status: string; goal: string | null }>;
  notes: Array<{ id: string; title: string | null; content: string | null }>;
}

export interface CommandRowItem {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  shortcut?: string;
  run: () => Promise<unknown> | unknown;
}

export function commandsToRows(commands: VanguardCommand[]): CommandRowItem[] {
  return commands.map((command) => ({
    id: `command-${command.id}`,
    title: command.title,
    subtitle: command.subtitle,
    icon: command.icon,
    shortcut: command.shortcut,
    run: command.run,
  }));
}

export function searchToRows(
  results: SearchResults,
  navigate: (path: string) => void,
  close: () => void,
): CommandRowItem[] {
  const go = (path: string) => () => { navigate(path); close(); };
  return [
    ...results.todos.map((todo) => ({ id: `todo-${todo.id}`, title: todo.title, subtitle: `Zadanie · ${todo.status}`, icon: CheckCircle2, run: go(`/todo?task=${todo.id}`) })),
    ...results.notes.map((note) => ({ id: `note-${note.id}`, title: note.title || 'Bez tytułu', subtitle: 'Notatka', icon: Bookmark, run: go(`/keep?note=${note.id}`) })),
    ...results.projects.map((project) => ({ id: `project-${project.id}`, title: project.name, subtitle: `Kierunek · ${project.status}`, icon: Folder, run: go(`/projekty?project=${project.id}`) })),
    ...results.graph.map((fact, index) => ({
      id: `fact-${index}`,
      title: `${fact.source_entity} → ${fact.target_entity}`,
      subtitle: fact.fact_text || fact.relation,
      icon: Sparkles,
      run: () => undefined,
    })),
  ];
}

