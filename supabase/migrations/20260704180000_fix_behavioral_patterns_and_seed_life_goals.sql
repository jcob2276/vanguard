-- Allow 'hypothesis' status in vanguard_behavioral_patterns
ALTER TABLE public.vanguard_behavioral_patterns
  DROP CONSTRAINT IF EXISTS vanguard_behavioral_patterns_status_check;

ALTER TABLE public.vanguard_behavioral_patterns
  ADD CONSTRAINT vanguard_behavioral_patterns_status_check
  CHECK (status IN ('pending', 'visible', 'user_confirmed', 'user_rejected', 'snoozed', 'archived', 'hypothesis'));

-- Seed default life goals for the canonical user if they do not exist
INSERT INTO public.life_goals (user_id, goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto, bhag_pillar)
VALUES (
  '165ae341-670c-46ce-82dc-434c4dbfcdfd',
  'Dokończyć transformację sylwetki do końca roku — widoczna redukcja tkanki tłuszczowej, rytm snu 7-8h i treningi bez pauzowania.',
  '365 dni No-Drift Morning z rzędu — zero telefonu w pierwsze 90 minut każdego dnia, pełna kontrola ramy.',
  'Zostać Top Closerem: prowadzę High-Ticket rozmowy z pozycji doradcy, min. 100k zł zamkniętych umów.',
  '2026-12-31', '2027-01-01', '2027-07-04',
  'duch'
)
ON CONFLICT (user_id) DO NOTHING;
