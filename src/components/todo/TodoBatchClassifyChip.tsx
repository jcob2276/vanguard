import { Sparkles } from 'lucide-react';
import { useTodoContext } from './context/TodoContext';

export default function TodoBatchClassifyChip() {
  const { items, batchClassify, batchClassifying } = useTodoContext();

  const unclassifiedCount = items.filter((i) => i.status === 'open' && !i.ai_bucket && !i.due_date).length;
  if (!unclassifiedCount) return null;

  return (
    <button
      onClick={batchClassify}
      disabled={batchClassifying}
      className="relative overflow-hidden w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 px-4 py-3 text-left transition-all hover:scale-[1.01] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:scale-[0.99] disabled:opacity-50 cursor-pointer group animate-[pulse_4s_infinite] shadow-[0_0_12px_rgba(99,102,241,0.06)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
          <Sparkles size={14} className={`${batchClassifying ? 'animate-spin' : 'animate-pulse group-hover:scale-110 transition-transform'}`} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-text-primary">
            {batchClassifying ? 'Porządkowanie zadań...' : 'Szybka klasyfikacja z AI'}
          </span>
          <span className="text-xs text-text-muted">
            {batchClassifying ? 'Analizuję treść przez DeepSeek' : `${unclassifiedCount} zadań czeka na automatyczne przypisanie`}
          </span>
        </div>
      </div>
      <div className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider scale-90 group-hover:scale-95 transition-transform">
        Start
      </div>
    </button>
  );
}
