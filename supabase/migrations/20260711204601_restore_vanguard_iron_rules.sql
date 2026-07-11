-- ============================================================
-- RESTORE vanguard_iron_rules FROM graveyard TO public
-- ============================================================
-- vanguard_iron_rules is a documented, active feature (VANGUARD_STATE.md: "Zasady
-- zadeklarowane przez użytkownika", read into Oracle RAG context) but the table lives
-- in the graveyard schema (moved there outside of any migration — no record of why).
-- vanguard-oracle/oracle/rag.ts queries public.vanguard_iron_rules, which doesn't
-- exist, so the query has always silently returned no rows (error caught, context
-- stays empty) — found via scripts/ops/check-data-contracts.mjs orphan triage.
-- Table is empty (0 rows) in graveyard, so this is a pure schema move, no data risk.

ALTER TABLE graveyard.vanguard_iron_rules SET SCHEMA public;
