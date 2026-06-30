-- Per-task quantity (target_value) and "kiedy w ciągu dnia" (time_slot) for the 5 daily wins.

ALTER TABLE public.daily_wins
  ADD COLUMN IF NOT EXISTS task_1_target_value text,
  ADD COLUMN IF NOT EXISTS task_2_target_value text,
  ADD COLUMN IF NOT EXISTS task_3_target_value text,
  ADD COLUMN IF NOT EXISTS task_4_target_value text,
  ADD COLUMN IF NOT EXISTS task_5_target_value text,
  ADD COLUMN IF NOT EXISTS task_1_time_slot text,
  ADD COLUMN IF NOT EXISTS task_2_time_slot text,
  ADD COLUMN IF NOT EXISTS task_3_time_slot text,
  ADD COLUMN IF NOT EXISTS task_4_time_slot text,
  ADD COLUMN IF NOT EXISTS task_5_time_slot text;

ALTER TABLE public.daily_wins
  ADD CONSTRAINT daily_wins_task_1_time_slot_check CHECK (task_1_time_slot IS NULL OR task_1_time_slot IN ('morning', 'noon', 'afternoon', 'evening')),
  ADD CONSTRAINT daily_wins_task_2_time_slot_check CHECK (task_2_time_slot IS NULL OR task_2_time_slot IN ('morning', 'noon', 'afternoon', 'evening')),
  ADD CONSTRAINT daily_wins_task_3_time_slot_check CHECK (task_3_time_slot IS NULL OR task_3_time_slot IN ('morning', 'noon', 'afternoon', 'evening')),
  ADD CONSTRAINT daily_wins_task_4_time_slot_check CHECK (task_4_time_slot IS NULL OR task_4_time_slot IN ('morning', 'noon', 'afternoon', 'evening')),
  ADD CONSTRAINT daily_wins_task_5_time_slot_check CHECK (task_5_time_slot IS NULL OR task_5_time_slot IN ('morning', 'noon', 'afternoon', 'evening'));
