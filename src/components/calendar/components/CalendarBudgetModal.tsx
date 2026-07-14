import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { LIFE_SPHERES } from '../../../lib/projects/lifeSpheres';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';

export default function CalendarBudgetModal() {
  const {
    calData: {
      showBudgetConfig,
      setShowBudgetConfig,
      budgetMinInputs,
      setBudgetMinInputs,
      budgetMaxInputs,
      setBudgetMaxInputs,
      setToastMessage,
    },
    timeBudgets: {
      saveBudget,
      refresh: refreshBudgets,
    },
  } = useCalendar();

  if (!showBudgetConfig) return null;

  const handleSaveAll = async () => {
    try {
      await Promise.all(
        LIFE_SPHERES.map((sphere) => {
          const minVal = budgetMinInputs[sphere.id] ? parseFloat(budgetMinInputs[sphere.id]) : null;
          const maxVal = budgetMaxInputs[sphere.id] ? parseFloat(budgetMaxInputs[sphere.id]) : null;
          return saveBudget(sphere.id, minVal, maxVal);
        })
      );
      setToastMessage('Budżety zapisane! 📊');
      await refreshBudgets();
      setShowBudgetConfig(false);
    } catch {
      setToastMessage('Błąd zapisu budżetów');
    }
  };

  return (
    <Modal isOpen={!!showBudgetConfig} onClose={() => setShowBudgetConfig(false)} title="Ustaw Budżety Czasu" size="sm">
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {LIFE_SPHERES.map((sphere) => {
          let placeholderMin = 'np. 3';
          let placeholderMax = 'brak';
          if (sphere.id === 'praca') {
            placeholderMin = 'np. 30';
            placeholderMax = 'np. 45';
          } else if (sphere.id === 'cialo_trening') {
            placeholderMin = 'np. 5';
          }

          return (
            <div key={sphere.id} className="space-y-1.5 border-none p-0">
              <span className="text-xs font-bold text-text-primary block">{sphere.label}</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col space-y-1">
                  <span className="text-2xs font-black uppercase tracking-widest text-text-muted">
                    Min (godzin/tyg)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder={placeholderMin}
                    value={budgetMinInputs[sphere.id] || ''}
                    onChange={(e) =>
                      setBudgetMinInputs({ ...budgetMinInputs, [sphere.id]: e.target.value })
                    }
                    className="w-full rounded-xl border border-border-custom bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary/40"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-2xs font-black uppercase tracking-widest text-text-muted">
                    Max (godzin/tyg)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder={placeholderMax}
                    value={budgetMaxInputs[sphere.id] || ''}
                    onChange={(e) =>
                      setBudgetMaxInputs({ ...budgetMaxInputs, [sphere.id]: e.target.value })
                    }
                    className="w-full rounded-xl border border-border-custom bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary/40"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="primary"
        onClick={handleSaveAll}
        className="w-full py-3 text-sm uppercase"
      >
        Zapisz Budżety
      </Button>
    </Modal>
  );
}
