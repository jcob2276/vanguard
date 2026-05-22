-- Add ASCII-safe ontology aliases used by current extraction prompts.

INSERT INTO public.vanguard_relation_ontology (relation, description) VALUES
  ('dazy_do', 'Aktywne dzialanie w kierunku celu, ASCII canonical'),
  ('nastepuje_po', 'Sekwencja czasowa po zdarzeniu, ASCII canonical'),
  ('uzywa', 'Korzystanie z narzedzia lub technologii, ASCII canonical'),
  ('doswiadcza', 'Przezywanie zdarzenia lub stanu, ASCII canonical'),
  ('osiaga', 'Realizacja celu lub sukcesu, ASCII canonical')
ON CONFLICT (relation) DO NOTHING;

UPDATE public.vanguard_entity_links
SET relation = CASE
  WHEN relation IN ('dąży_do', 'dÄ…ĹĽy_do') THEN 'dazy_do'
  WHEN relation IN ('następuje_po', 'nastÄ™puje_po') THEN 'nastepuje_po'
  WHEN relation IN ('używa', 'uĹĽywa') THEN 'uzywa'
  WHEN relation IN ('doświadcza', 'doĹ›wiadcza') THEN 'doswiadcza'
  WHEN relation IN ('osiąga', 'osiÄ…ga') THEN 'osiaga'
  ELSE relation
END
WHERE relation IN (
  'dąży_do', 'dÄ…ĹĽy_do',
  'następuje_po', 'nastÄ™puje_po',
  'używa', 'uĹĽywa',
  'doświadcza', 'doĹ›wiadcza',
  'osiąga', 'osiÄ…ga'
);
