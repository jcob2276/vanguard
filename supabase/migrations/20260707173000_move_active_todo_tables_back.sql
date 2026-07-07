-- Move todo_smart_lists and todo_attachments back to public schema as they are actively used by the frontend.

ALTER TABLE graveyard.todo_smart_lists SET SCHEMA public;
ALTER TABLE graveyard.todo_attachments SET SCHEMA public;
