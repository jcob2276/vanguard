-- Sync completed todo items to growth pins
CREATE OR REPLACE FUNCTION public.sync_todo_done_to_growth_pins()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
        UPDATE public.learning_week_pins 
        SET done = true, done_at = COALESCE(NEW.updated_at, now())
        WHERE entity_type = 'todo' AND entity_id = NEW.id AND done = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_todo_done_to_growth_pins
AFTER UPDATE ON public.todo_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_todo_done_to_growth_pins();

-- Sync read links to growth pins
CREATE OR REPLACE FUNCTION public.sync_link_read_to_growth_pins()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'read' AND (OLD.status IS NULL OR OLD.status != 'read') THEN
        UPDATE public.learning_week_pins 
        SET done = true, done_at = COALESCE(NEW.updated_at, now())
        WHERE entity_type = 'link' AND entity_id = NEW.id AND done = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_link_read_to_growth_pins
AFTER UPDATE ON public.vanguard_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_link_read_to_growth_pins();
