# Active Work

Migawka tego, co jest **w trakcie** teraz — nie kolejka, nie plan. Ten plik jest
nadpisywany na starcie i końcu każdej wieloetapowej sesji (np. wieloplikowy refaktor
rozłożony na kilka commitów), nie akumulowany. Gdy praca się kończy, ten plik wraca
do stanu "nic w toku" — otwarte resztki lądują w [`../../BACKLOG.md`](../../BACKLOG.md),
nie zostają tutaj.

## Stan: nic w toku

Ostatnia wieloetapowa sesja (frontend 10/10 + spłata długu, 2026-07-10/11) zamknięta
i skonsolidowana do `BACKLOG.md`, część IV. Następna praca do podjęcia — patrz tam:
P5 (3 pozostałe god-files), P6 (klasyfikacja ~111 plików), DS1/DS4 (reszta audytu UI).

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
