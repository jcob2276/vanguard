-- ============================================================
-- VANGUARD OS — IDENTITY FIX
-- Cel: Ustawienie na sztywno aktualnych studiów Jakuba.
-- ============================================================

UPDATE public.user_fundament
SET identity = 'Student 1. semestru Cyberbezpieczeństwa. Inżynier Danych i Specjalista Cyberbezpieczeństwa w procesie ciągłego rozwoju.'
WHERE user_id = '2893878b-1e23-455b-8012-14022b31a31c';
