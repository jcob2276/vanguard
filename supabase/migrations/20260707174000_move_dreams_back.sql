-- Move dreams table back to public schema as it is the root of the goal spine hierarchy.

ALTER TABLE graveyard.dreams SET SCHEMA public;
