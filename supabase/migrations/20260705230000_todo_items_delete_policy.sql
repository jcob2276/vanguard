-- todo_items has SELECT/INSERT/UPDATE RLS policies but was missing DELETE,
-- so deleteTodoItem() silently matched 0 rows instead of removing the task.
DROP POLICY IF EXISTS "todo_items_delete" ON public.todo_items;
CREATE POLICY "todo_items_delete" ON public.todo_items FOR DELETE USING ((select auth.uid()) = user_id);
