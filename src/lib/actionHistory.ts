export interface ReversibleAction {
  id?: string;
  label: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
}

export interface ActionHistorySnapshot {
  undoLabel: string | null;
  redoLabel: string | null;
  busy: boolean;
}

type Listener = (snapshot: ActionHistorySnapshot) => void;

interface StoredAction extends ReversibleAction {
  id: string;
}

const MAX_HISTORY = 40;
const listeners = new Set<Listener>();
let undoStack: StoredAction[] = [];
let redoStack: StoredAction[] = [];
let busy = false;

function snapshot(): ActionHistorySnapshot {
  return {
    undoLabel: undoStack.at(-1)?.label ?? null,
    redoLabel: redoStack.at(-1)?.label ?? null,
    busy,
  };
}

function emit() {
  const current = snapshot();
  listeners.forEach((listener) => listener(current));
}

export function subscribeActionHistory(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function registerReversibleAction(action: ReversibleAction): string {
  const id = action.id ?? crypto.randomUUID();
  undoStack = [...undoStack, { ...action, id }].slice(-MAX_HISTORY);
  redoStack = [];
  emit();
  return id;
}

export function removeReversibleAction(id: string): void {
  undoStack = undoStack.filter((action) => action.id !== id);
  redoStack = redoStack.filter((action) => action.id !== id);
  emit();
}

export async function undoLastAction(): Promise<boolean> {
  const action = undoStack.at(-1);
  if (!action || busy) return false;
  busy = true;
  emit();
  try {
    await action.undo();
    undoStack = undoStack.slice(0, -1);
    if (action.redo) redoStack = [...redoStack, action].slice(-MAX_HISTORY);
    return true;
  } finally {
    busy = false;
    emit();
  }
}

export async function undoAction(id: string): Promise<boolean> {
  const index = undoStack.findIndex((action) => action.id === id);
  const action = undoStack[index];
  if (!action || busy) return false;
  busy = true;
  emit();
  try {
    await action.undo();
    undoStack = undoStack.filter((entry) => entry.id !== id);
    if (action.redo) redoStack = [...redoStack, action].slice(-MAX_HISTORY);
    return true;
  } finally {
    busy = false;
    emit();
  }
}

export async function redoLastAction(): Promise<boolean> {
  const action = redoStack.at(-1);
  if (!action?.redo || busy) return false;
  busy = true;
  emit();
  try {
    await action.redo();
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, action].slice(-MAX_HISTORY);
    return true;
  } finally {
    busy = false;
    emit();
  }
}

export function clearActionHistory(): void {
  undoStack = [];
  redoStack = [];
  busy = false;
  emit();
}
