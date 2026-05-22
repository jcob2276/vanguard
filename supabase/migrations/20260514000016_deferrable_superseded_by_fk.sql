-- Allow Graphiti-style singleton superseding inside one transaction.
-- upsert_vanguard_entity_link marks old edges as superseded_by = new_id
-- before inserting the new edge; the FK must be checked at transaction end.

ALTER TABLE public.vanguard_entity_links
DROP CONSTRAINT IF EXISTS vanguard_entity_links_superseded_by_fkey;

ALTER TABLE public.vanguard_entity_links
ADD CONSTRAINT vanguard_entity_links_superseded_by_fkey
FOREIGN KEY (superseded_by)
REFERENCES public.vanguard_entity_links(id)
DEFERRABLE INITIALLY DEFERRED;
