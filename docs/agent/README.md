# Agent Context Map

Ten katalog nie jest drugą konstytucją repo. To indeks dla agentów, żeby szybko ładować właściwe warstwy pamięci bez budowania równoległych zasad.

## Authority Order

1. `AGENTS.md` — konstytucja repo, deploy rules, architektura pracy.
2. `docs/ARCHITECTURE.md` — aktualny przepływ danych i granice systemu.
3. `supabase/functions/README.md` — rejestr edge functions i JWT.
4. `docs/DEV_GUIDE.md` — konwencje implementacji.
5. `.cursor/rules/*.mdc` — szczegółowe zasady workflow, kontekstu i ops.
6. `docs/PRODUCT_LANGUAGE.md` — kanoniczny słownik produktu dla UI/docs/agentów.
7. `CLAUDE.md` — lekki router dla Claude/Antigravity, nie source of truth.
8. `lessons.md` — trwałe lekcje techniczne agentów.

## Domain Memory

- `docs/career/identity.md` — deklarowana tożsamość i standard zachowania w domenie sprzedaży.
- `docs/career/skills.md` — ćwiczenia i drille.
- `docs/career/lessons.md` — log błędów sprzedażowych i korekt.

## Rule

Jeśli instrukcje są sprzeczne, wygrywa plik położony wyżej w `Authority Order`. Domenowe markdowni mogą zasilać produkt i rozmowy, ale nie mogą zmieniać konstytucji systemu, write pathów ani guardraili.

## Naming

Nowe copy i dokumenty mają używać `docs/PRODUCT_LANGUAGE.md`: Plan, Move/Ruch, Artifact/Artefakt, Evidence/Dowód, Reflection/Refleksja, Note/Notatka, Task/Zadanie.
