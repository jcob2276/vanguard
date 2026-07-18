import { Globe2, Plus, Sparkles } from 'lucide-react';
import { Pressable } from '../../../ui/ControlPrimitives';
import FoodRow from '../FoodRow';
import type { FoodBase } from '../hooks/foodEntryUtils';

export interface FoodSearchResultsProps {
  query: string;
  searching: boolean;
  searchResults: FoodBase[];
  externalSearching: boolean;
  externalSearched: boolean;
  searchExternal: () => void;
  quickAddingId: string | null;
  setSelected: (value: FoodBase | null) => void;
  setGrams: (value: string) => void;
  quickAddSearchResult: (food: FoodBase) => void;
  openNaturalLanguage: (query: string) => void;
}

export default function FoodSearchResults(props: FoodSearchResultsProps) {
  const { query, searching, searchResults, externalSearching, externalSearched,
    searchExternal, quickAddingId, setSelected, setGrams, quickAddSearchResult,
    openNaturalLanguage } = props;
  return (
    <div className="space-y-1.5">
      <p className="mb-2 text-2xs font-black uppercase tracking-wider text-text-muted">
        Twoja biblioteka · plus dodaje sugerowaną porcję
      </p>
      {searchResults.length === 0 && !searching && (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-text-muted">
            {externalSearched ? `Brak kompletnego produktu dla „${query}”` : `Brak w Twojej bibliotece dla „${query}”`}
          </p>
          {!externalSearched && (
            <Pressable variant="outline" size="sm" onClick={searchExternal} loading={externalSearching}
              icon={<Globe2 size={13} />} className="inline-flex">
              Szukaj w bazie produktów
            </Pressable>
          )}
          <Pressable variant="tonal" size="sm" onClick={() => openNaturalLanguage(query)}
            icon={<Sparkles size={13} />} className="inline-flex">
            Opisz posiłek słowami
          </Pressable>
        </div>
      )}
      {searchResults.map((food, index) => {
        const grams = food.defaultGrams ?? 100;
        const calories = food.calories == null ? null : Math.round(food.calories * grams / 100);
        return (
          <FoodRow key={`${food.barcode || food.name}-${index}`} name={food.name}
            subtitle={[food.brand, `${grams}g/ml`].filter(Boolean).join(' · ')} calories={calories}
            loading={quickAddingId === `srch:${food.name}`}
            onTap={() => { setSelected(food); setGrams(String(grams)); }}
            onQuickAdd={() => quickAddSearchResult(food)} quickAddIcon={<Plus size={13} />} />
        );
      })}
    </div>
  );
}
