-- Daily Strain v1.1: oznaczanie dzisiejszego fueling jako tymczasowego (provisional).
-- Powód: fueling_score dla DZIŚ jest liczony o 11:15 (środek dnia), gdy Yazio
-- jest jeszcze niedomknięte. Bez tej flagi dzisiejszy fueling jest przedwcześnie
-- niski (np. 437 kcal → fueling 17), co tworzy fałszywy czerwony alert i błędnie
-- ustawia main_limiter='calories'.

ALTER TABLE public.daily_strain
  ADD COLUMN IF NOT EXISTS fueling_provisional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.daily_strain.fueling_provisional IS
  'TRUE gdy wiersz dotyczy dnia bieżącego (Europe/Warsaw) — fueling jeszcze niepełny, nie liczony do strain ani jako limiter calories/carbs.';
