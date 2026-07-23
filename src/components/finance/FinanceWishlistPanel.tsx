import { getTodayWarsaw, shiftDateStr } from '../../lib/date';

import Button from '../ui/Button';

import { formatPln } from '../../lib/finance/formatMoney';

import type { FinanceWishlistItem } from '../../lib/financeApi';

import { QuickAddForm } from './financeShared';

import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';



interface FinanceWishlistPanelProps {

  items: FinanceWishlistItem[];

  freedomDaysForAmount: (amount: number) => number;

  onAdd: (input: { name: string; price: number }) => void;

  onUpdate: (input: { id: string; still_want?: boolean; cool_off_until?: string | null }) => void;

  onRemove: (id: string) => void;

}



function coolOffStatus(item: FinanceWishlistItem, today: string): 'active' | 'expired' | 'none' {

  if (!item.cool_off_until) return 'none';

  if (item.cool_off_until > today) return 'active';

  return 'expired';

}



function extendCoolOff(days: number): string {

  return shiftDateStr(getTodayWarsaw(), days);

}



export function FinanceWishlistPanel({

  items,

  freedomDaysForAmount,

  onAdd,

  onUpdate,

  onRemove,

}: FinanceWishlistPanelProps) {

  const today = getTodayWarsaw();

  const visible = items.filter((i) => i.still_want);



  return (

    <FinanceSection

      title="Zanim kupisz"

      subtitle="30 dni przerwy — potem sam decydujesz."

    >

      <QuickAddForm

        fields={[

          { key: 'name', placeholder: 'Co chcesz' },

          { key: 'price', placeholder: 'Cena', type: 'number' },

        ]}

        onSubmit={(v) => onAdd({ name: v.name, price: Number(v.price) })}

      />

      {visible.length === 0 ? (

        <FinanceEmpty>Lista pusta. Dodaj coś, co ci chodzi po głowie — i poczekaj 30 dni.</FinanceEmpty>

      ) : (

        <FinanceList>

          {visible.map((item) => {

            const status = coolOffStatus(item, today);

            const days = freedomDaysForAmount(item.price);

            const secondary = [

              `${formatPln(item.price)} · ${days.toFixed(0)} dni wolności`,

              status === 'active' ? `Ochłonij do ${item.cool_off_until}` : null,

              status === 'expired' ? 'Czas minął — możesz podjąć decyzję' : null,

            ].filter(Boolean).join(' · ');



            return (

              <FinanceRow key={item.id} primary={item.name} secondary={secondary}>

                <div className="mt-3 flex flex-wrap gap-2">

                  {status === 'expired' && (

                    <>

                      <Button size="sm" onClick={() => onUpdate({ id: item.id, cool_off_until: null })} className="rounded-lg active:scale-[var(--scale-pressed)]">

                        Kupuję

                      </Button>

                      <Button size="sm" variant="secondary" onClick={() => onUpdate({ id: item.id, still_want: false })} className="rounded-lg active:scale-[var(--scale-pressed)]">

                        Rezygnuję

                      </Button>

                      <Button size="sm" variant="ghost" onClick={() => onUpdate({ id: item.id, cool_off_until: extendCoolOff(30) })}>

                        +30 dni

                      </Button>

                    </>

                  )}

                  <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)} className="text-danger">

                    Usuń

                  </Button>

                </div>

              </FinanceRow>

            );

          })}

        </FinanceList>

      )}

    </FinanceSection>

  );

}

