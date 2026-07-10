import { ArrowLeft, CheckSquare, Grid3X3, LayoutList, Search, X } from 'lucide-react';

interface KeepHeaderProps {
  onBack: () => void;
  search: string;
  setSearch: (v: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (fn: (v: 'grid' | 'list') => 'grid' | 'list') => void;
}

export default function KeepHeader({ onBack, search, setSearch, viewMode, setViewMode }: KeepHeaderProps) {
  return (
    <header className="keep-header">
      <div className="keep-header-left">
        <button onClick={onBack} className="keep-back-btn" title="Wróć">
          <ArrowLeft size={16} />
        </button>
        <div className="keep-logo">
          <CheckSquare size={18} className="keep-logo-icon" />
          <span>Notatki</span>
        </div>
      </div>

      <div className="keep-search-wrap">
        <Search size={14} className="keep-search-icon" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj notatek…"
          className="keep-search"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="keep-search-clear">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="keep-header-right">
        <button
          type="button"
          onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
          className="keep-icon-btn"
          title={viewMode === 'grid' ? 'Lista' : 'Siatka'}
        >
          {viewMode === 'grid' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
        </button>
      </div>
    </header>
  );
}
