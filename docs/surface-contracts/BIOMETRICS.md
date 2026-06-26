# Biometrics Surface Contracts

Small contract for Vanguard biometric surfaces. This is not a product spec.
It is a regression checklist for claims, empty states, and UI decisions.

## Global Rule

No biometric surface should silently disappear when data is missing.
Missing, stale, provisional, or unavailable data must be visible to the user.

Biometric claims must stay deterministic:

- claim has a source table/view/function
- claim has a date or window
- missing data is stated as missing
- provisional data cannot drive final conclusions

## DailyStrainCard

Acceptance checks:

- If `daily_strain` has no row, show an unavailable state, not `null`.
- If the query fails, show the failed source name and error summary.
- If `fueling_provisional=true`, UI must not present calories/carbs as a final limiter.
- If `fueling_provisional=true`, show that the food log for today is not closed yet.
- If `strain_score`, `recovery_score`, or `fueling_score` is `null`, show which signal is missing.
- The decision text must come from `daily_status`, `main_limiter`, and provisional state only.

Example guarded claim:

> Fueling is provisional today. Do not infer a final calorie deficit until today's food log is closed.

## OuraEnhanced

Acceptance checks:

- If `oura_hr_zones_daily` has no rows, show "Brak stref HR" and do not render an empty chart.
- If correlations are unavailable, show that the view/data is missing.
- If `n_dni < 60`, show the sample size warning.
- Correlation rows must include source families such as Oura, food log, Strava, or strain.
- A hidden chart section must still leave a visible data-state notice.
- Query errors from `oura_enhanced`, `oura_correlations`, `strain_correlations`, or `oura_hr_zones_daily` must be visible.

## Vanguard Oracle Biometric Context

Acceptance checks:

- If `fueling_provisional=true`, Oracle must not claim a final calorie deficit.
- Claims about training, recovery, food, sleep, or readiness must include the source window.
- If `daily_strain` is missing, Oracle says it is missing instead of inferring form.
- If the user asks "can I push today?", Oracle should use `daily_strain` first.
- If data is incomplete, Oracle should name the incomplete input instead of filling the gap narratively.

## Vanguard Analyst

Acceptance checks:

- If a correlation is absent or below threshold, Analyst must not invent it.
- If sample size is low, Analyst says the hypothesis is weak.
- Micro-tests may use measured load/recovery, but not unstated causal claims.
- Output must preserve the existing JSON contract.

## Sync Functions

Acceptance checks:

- Sync functions should return which dates were upserted or why none were.
- Unsupported external endpoints should degrade to empty data, not fail the whole sync.
- Compute functions should make provisional states explicit when a day is not closed.
- After Oura/food-log/Strava sync, `compute-daily-strain` should be rerunnable idempotently.
