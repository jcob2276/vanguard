-- Training plan workouts
CREATE TABLE IF NOT EXISTS training_plan_workouts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number         integer NOT NULL,
  day_of_week         text NOT NULL, -- 'monday'...'sunday'
  planned_date        date,          -- filled when plan starts
  workout_type        text NOT NULL, -- ER, INT, FART, LR, PROG, POD, SIL
  workout_name        text NOT NULL,
  description         text,
  goal                text,
  -- Targets (nullable — not all workouts have all targets)
  target_duration_min integer,
  target_distance_km  float,
  target_hr_max       integer,
  target_pace_min_km  text,          -- "5:50" — slowest target pace
  target_pace_max_km  text,          -- "5:00" — fastest target pace
  -- Linking to Strava
  strava_activity_id  bigint REFERENCES strava_activities(strava_id),
  completed           boolean DEFAULT false,
  completion_notes    text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_plan_user_date
  ON training_plan_workouts(user_id, planned_date);

-- Seed plan — Tydzień 1 start: 2026-05-19 (Monday)
INSERT INTO training_plan_workouts
  (user_id, week_number, day_of_week, planned_date, workout_type, workout_name, description, goal, target_duration_min, target_hr_max)
VALUES
  (
    '165ae341-670c-46ce-82dc-434c4dbfcdfd',
    1, 'wednesday', '2026-05-21',
    'ER', 'ER 40'' (poniżej 155 BPM)',
    'Trening wydolnościowy polegający na 40-minutowym biegu ciągłym o niskiej intensywności. Głównym celem jest utrzymanie tętna na poziomie maksymalnie 155 BPM. W przypadku przekroczenia tętna przejść do marszu 200–400 m. Lepiej biec tempem 6:40/7:00 min/km niż robić marszobieg.',
    'Budowanie bazy tlenowej.',
    40, 155
  ),
  (
    '165ae341-670c-46ce-82dc-434c4dbfcdfd',
    1, 'friday', '2026-05-23',
    'INT', 'INT - 6×400 m / 400m odp.',
    '2 km rozgrzewka w tempie konwersacyjnym. 6×400 m w tempie ~4:35 min/km (ok. 1:50 na 400 m). Po każdym odcinku 400 m regeneracji (200 m trucht + 200 m marsz). 2 km wybieganie. Kluczowe: równe tempo na wszystkich 6 odcinkach, nie zaczynać za szybko.',
    'Poprawa wytrzymałości tempowej i zdolności do utrzymania równego tempa przy niepełnej regeneracji.',
    NULL, NULL
  ),
  (
    '165ae341-670c-46ce-82dc-434c4dbfcdfd',
    2, 'monday', '2026-05-26',
    'ER', 'ER 40'' (poniżej 155 BPM)',
    'Trening wydolnościowy polegający na 40-minutowym biegu ciągłym o niskiej intensywności. Głównym celem jest utrzymanie tętna na poziomie maksymalnie 155 BPM. W przypadku przekroczenia tętna przejść do marszu 200–400 m. Lepiej biec tempem 6:40/7:00 min/km niż robić marszobieg.',
    'Budowanie bazy tlenowej.',
    40, 155
  ),
  (
    '165ae341-670c-46ce-82dc-434c4dbfcdfd',
    2, 'wednesday', '2026-05-28',
    'FART', 'FART 5 km (5:50 → 5:00 min/km)',
    'Bieg 5 km z kontrolowanym przyspieszaniem tempa. Start 5:50 min/km, każdy kolejny km ok. 10 sek szybciej, cel końcowy 5:00 min/km. Tętno w końcowej fazie max 170 BPM. Cel: nauka tempa i płynna zmiana prędkości — nie biec na maksa.',
    'Rozwijanie wyczucia tempa i zdolności do utrzymania wyższych prędkości przy kontrolowanym tętnie.',
    NULL, 170
  ),
  (
    '165ae341-670c-46ce-82dc-434c4dbfcdfd',
    2, 'saturday', '2026-05-31',
    'ER', 'ER 50'' (poniżej 155 BPM)',
    'Trening wydolnościowy polegający na 50-minutowym biegu ciągłym o niskiej intensywności. Głównym celem jest utrzymanie tętna na poziomie maksymalnie 155 BPM. W przypadku przekroczenia tętna przejść do marszu 200–400 m. Lepiej biec tempem 6:40/7:00 min/km niż robić marszobieg.',
    'Budowanie bazy tlenowej.',
    50, 155
  );
