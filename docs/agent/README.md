# Agent Context Map

Ten katalog nie jest drugą konstytucją repo. To indeks dla agentów, żeby szybko ładować właściwe warstwy pamięci bez budowania równoległych zasad.

## Reading Order

**SSOT:** [`docs/READING_ORDER.md`](../READING_ORDER.md) — kanoniczna kolejność czytania dla agentów.

## Domain Memory

- `docs/career/identity.md` — deklarowana tożsamość i standard zachowania w domenie sprzedaży.
- `docs/career/skills.md` — ćwiczenia i drille.
- `docs/career/lessons.md` — log błędów sprzedażowych i korekt.

## Rule

Jeśli instrukcje są sprzeczne, wygrywa plik wyżej w `READING_ORDER.md`. Domenowe markdowni mogą zasilać produkt i rozmowy, ale nie mogą zmieniać konstytucji systemu, write pathów ani guardraili.

## Naming

Nowe copy i dokumenty mają używać `docs/PRODUCT_LANGUAGE.md`: Plan, Move/Ruch, Artifact/Artefakt, Evidence/Dowód, Reflection/Refleksja, Note/Notatka, Task/Zadanie.
