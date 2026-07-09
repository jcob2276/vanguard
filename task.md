- [x] Compact font sizes and spacings in `src/components/todo/TodoCard.tsx`
- [x] Compact font sizes and spacings in `src/components/todo/BucketHeader.tsx`
- [x] Compact font sizes and spacings in `src/components/todo/TodoSidebar.tsx`
- [x] Compact font sizes and spacings in `src/components/todo/TodoQuickCapture.tsx`
- [x] Verify everything compiles and builds successfully

## Resolution Layer / Partner Mode (blokowane przez Hard Freeze do 10.07.2026 17:00 UTC — patrz implementation_plan.md)
- [ ] Backfill `entity_aliases` dla istniejących 232 encji
- [ ] Ręczny merge: Kinga/Kuzynka Kinga, Cyberbezpieczenstwo/Cyberbezpieczeństwo
- [ ] Dodać krok B2 (fuzzy match + kind guardrail + confidence gap) do `resolve_entity()` + indeks GIN na `entity_aliases.alias`
- [ ] Podłączyć `fetchWorldState()` w `queryOracle` zamiast ręcznego Promise.all
- [ ] Dodać Resolution Layer (Tier 1 trigram / Tier 2 embedding+LLM) + odczyt `public.claims` do `queryOracle`
- [ ] Deploy `vanguard-telegram` po zdjęciu freeze
