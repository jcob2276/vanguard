-- Move remaining active tables back to the public schema as they are used by the UI/hooks.

ALTER TABLE graveyard.push_subscriptions SET SCHEMA public;
ALTER TABLE graveyard.location_history SET SCHEMA public;
ALTER TABLE graveyard.endmyopia_daily_logs SET SCHEMA public;
ALTER TABLE graveyard.learning_skill_snapshots SET SCHEMA public;
ALTER TABLE graveyard.learning_week_pins SET SCHEMA public;
ALTER TABLE graveyard.vision_board_items SET SCHEMA public;
