-- Thermodynamic weight/BF forecast (30/60/90d) + adaptive weekly calorie correction,
-- computed by vanguard-nutrition-coach alongside the existing triangulated target.
ALTER TABLE nutrition_targets
  ADD COLUMN forecast_30d_weight_kg numeric,
  ADD COLUMN forecast_60d_weight_kg numeric,
  ADD COLUMN forecast_90d_weight_kg numeric,
  ADD COLUMN forecast_30d_bf_pct numeric,
  ADD COLUMN forecast_60d_bf_pct numeric,
  ADD COLUMN forecast_90d_bf_pct numeric,
  ADD COLUMN days_to_goal_est integer,
  ADD COLUMN adaptive_correction_kcal integer;
