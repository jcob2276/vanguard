CREATE POLICY "Dashboard read access" ON public.vanguard_entity_links FOR SELECT USING (user_id = '165ae341-670c-46ce-82dc-434c4dbfcdfd');
