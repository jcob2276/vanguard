import { useState } from 'react';

const BORN = new Date('2002-07-06');

const FUEL = [
  "Przyszłe ty ma nadzieję,\nże dzisiejsze ty nie odpuści.",
  "Nie żałujesz decyzji które podjąłeś.\nTylko tych których nie podjąłeś.",
  "Za rok będziesz tu\nalbo znacznie dalej.\nTy decydujesz dziś.",
  "Każda wielka zmiana zaczęła się\nod jednego zwykłego dnia.",
  "Entuzjazm to nie nastrój.\nTo decyzja którą podejmujesz rano.",
  "Dyskomfort który czujesz\nto dowód że rośniesz.",
  "Nie musisz mieć ochoty.\nMusisz tylko zacząć.",
  "Jedyne o czym będziesz żałować\nto że nie zacząłeś wcześniej.",
  "Twoje najlepsze lata\nnie są za tobą.",
  "Za 5 lat docenisz\nkażdą decyzję którą podjąłeś dziś.",
  "To nie jest próba.\nTo jest twoje życie.",
  "Nikt za ciebie nie będzie żałował\nże nie spróbowałeś.",
];

export default function DayCounter() {
  const [lived] = useState(() => Math.floor((Date.now() - BORN.getTime()) / 86400000));
  const quote = FUEL[lived % FUEL.length];
  return (
    <div className="py-4.5 px-5 border-l-4 border-primary/50 bg-primary/[0.02] dark:bg-primary/[0.04] backdrop-blur-md rounded-r-[24px] my-2 shadow-sm">
      <p className="font-display text-[14.5px] font-medium leading-relaxed text-text-primary italic whitespace-pre-line">
        "{quote}"
      </p>
    </div>
  );
}
