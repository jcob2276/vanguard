# Vanguard Agent Lessons

Pamięć agenta o napotkanych problemach i ich rozwiązaniach między sesjami. Przed rozpoczęciem każdego zadania sprawdź te wpisy, aby nie powtarzać błędów.

| Data | Zadanie | Problem | Lekcja |
|---|---|---|---|
| 2026-06-14 | Weekly Board implementation | Arithmetic subtraction of Date objects directly causes type errors in TypeScript (TS2362 / TS2363). | Zawsze używaj `.getTime()` przy odejmowaniu lub sortowaniu obiektów `Date` w TS. |
| 2026-06-14 | Weekly Board implementation | Type inference of inline declared patch object blocks dynamic assignment of optional properties (like `due_date` when defined initially without it). | Zadeklaruj jawny typ obiektu (np. `patch: { ai_bucket: string; due_date?: string | null }`) przy tworzeniu patcha. |
| 2026-06-14 | UI component compile validation | `SectionTitle` component defined parameters mismatching inline props invocation without `action`. | Zawsze w definicji propsów komponentu w TS zaznaczaj parametry jako opcjonalne (`action?: any`) lub dodawaj wartości domyślne. |
