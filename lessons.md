# Vanguard Agent Lessons

Pamięć agenta o napotkanych problemach i ich rozwiązaniach między sesjami. Przed rozpoczęciem każdego zadania sprawdź te wpisy, aby nie powtarzać błędów.

| Data | Zadanie | Problem | Lekcja |
|---|---|---|---|
| 2026-06-14 | Weekly Board implementation | Arithmetic subtraction of Date objects directly causes type errors in TypeScript (TS2362 / TS2363). | Zawsze używaj `.getTime()` przy odejmowaniu lub sortowaniu obiektów `Date` w TS. |
| 2026-06-14 | Weekly Board implementation | Type inference of inline declared patch object blocks dynamic assignment of optional properties (like `due_date` when defined initially without it). | Zadeklaruj jawny typ obiektu (np. `patch: { ai_bucket: string; due_date?: string | null }`) przy tworzeniu patcha. |
| 2026-06-14 | UI component compile validation | `SectionTitle` component defined parameters mismatching inline props invocation without `action`. | Zawsze w definicji propsów komponentu w TS zaznaczaj parametry jako opcjonalne (`action?: any`) lub dodawaj wartości domyślne. |
| 2026-06-16 | Dodanie kolumny `life_goal` do `dreams` przez MCP migration | `database.types.ts` NIE jest automatycznie regenerowany po migracji — TS rzuca błąd `not assignable to type 'never'` na nowych polach. | Castuj payload insertu/updatu jako `as any` do czasu ręcznej regeneracji typów (`supabase gen types`). |
| 2026-06-16 | Picker celów życiowych w DesktopDashboard | `as const` na tablicy tupli wewnątrz `.map()` powoduje TS2322 bo destrukturyzacja nie może przypisać do literal type. | Zamiast `as const` używaj jawnego typu `[string, string, string][]`. |
| 2026-06-20 | CheckpointsCard w Dziś | Checkpointy miały `status = 'open'` w DB ale karta filtrowała `.eq('status', 'pending')` — karta zawsze była pusta. | Sprawdzaj rzeczywiste wartości enum w DB zanim piszesz filtr statusu; użyj `.in('status', ['pending', 'open'])` jako bezpieczna forma. |
