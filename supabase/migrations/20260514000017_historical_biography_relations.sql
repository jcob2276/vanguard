-- Historical biography relations.
-- These are intentionally not singleton relations. A person can have many past jobs,
-- studies and communities without overriding the current state.

INSERT INTO public.vanguard_relation_ontology (relation, description) VALUES
  ('pracowal_w', 'Historical work or organization affiliation'),
  ('studiowal', 'Historical studies or education path'),
  ('uczestniczyl_w', 'Historical participation in group, class or community')
ON CONFLICT (relation) DO NOTHING;
