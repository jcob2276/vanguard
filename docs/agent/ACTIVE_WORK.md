# Active Work

Migawka tego, co jest **w trakcie** teraz — nie kolejka, nie plan. Ten plik jest
nadpisywany na starcie i końcu każdej wieloetapowej sesji (np. wieloplikowy refaktor
rozłożony na kilka commitów), nie akumulowany. Gdy praca się kończy, ten plik wraca
do stanu "nic w toku" — otwarte resztki lądują w [`../../BACKLOG.md`](../../BACKLOG.md),
nie zostają tutaj.

## Stan: nic w toku

Ostatnia sesja: Faza 7 molochów — 20 plików >300 linii rozbitych do <300
(commity sesji 2026-07-12). Ratchet `check-line-limit.mjs` dodany do lint-staged.
Baseline `legacyLines` wyciszony (0 plików nad limitem). Faza 7 kontynuuje się
z ratchetem jako mechanizmem egzekwującym.

## Jak używać tego pliku

Zaczynasz sesję, która rozciąga się na wiele commitów (np. P6 z `BACKLOG.md` — dziesiątki
plików, kadencja "stop po Tier 3 / podsumowanie po 5 plikach Tier 1-2")? Nadpisz ten plik:

```markdown
## Stan: <nazwa wątku>, sesja od <data>

- Robię: <konkretnie co, z tabeli/checklisty w BACKLOG.md>
- Zrobione w tej sesji: <lista, aktualizowana na bieżąco>
- Zostało: <lista>
- Liczniki (jeśli dotyczy): <np. LEGACY_FILES: 111→X>
```

Po zamknięciu wątku: przenieś nieukończone punkty z powrotem do `BACKLOG.md`
(zaktualizuj tabelę/checklistę tam), wróć ten plik do stanu "nic w toku".
