-- ============================================================
-- VANGUARD OS — GRAPH RELATION ONTOLOGY
-- Wersja: 1.0 | Data: 2026-05-14
-- ============================================================

-- 1. TWORZENIE TABELI SŁOWNIKA
CREATE TABLE IF NOT EXISTS public.vanguard_relation_ontology (
    relation text PRIMARY KEY,
    description text,
    created_at timestamptz DEFAULT now()
);

-- 2. WYPEŁNIANIE SŁOWNIKA (35 KANONICZNYCH RELACJI)
INSERT INTO public.vanguard_relation_ontology (relation, description) VALUES
('jest', 'Stan lub tożsamość encji'),
('posiada', 'Własność lub posiadanie cechy'),
('studiuje', 'Aktywność edukacyjna'),
('pracuje_w', 'Zatrudnienie lub miejsce pracy'),
('mieszka_w', 'Lokalizacja zamieszkania'),
('ma_relację_z', 'Relacja interpersonalna (romantyczna, rodzinna)'),
('zna_osobę', 'Znajomość lub relacja koleżeńska'),
('chce', 'Pragnienie, intencja lub cel'),
('dąży_do', 'Aktywne działanie w kierunku celu'),
('unika', 'Świadome unikanie lub ucieczka przed czymś'),
('lęka_się', 'Strach, lęk lub fobia'),
('prowadzi_do', 'Związek przyczynowo-skutkowy'),
('spowodowane_przez', 'Wynikanie lub przyczyna'),
('poprzedza', 'Sekwencja czasowa (przed)'),
('następuje_po', 'Sekwencja czasowa (po)'),
('używa', 'Korzystanie z narzędzia lub technologii'),
('tworzy', 'Produkcja, kreacja lub budowanie'),
('ćwiczy', 'Aktywność fizyczna lub trening'),
('uczy_się', 'Nabywanie nowej wiedzy lub umiejętności'),
('deklaruje', 'Stwierdzenie lub wyznanie'),
('czuje', 'Stan emocjonalny lub fizyczny'),
('doświadcza', 'Przeżywanie zdarzenia lub stanu'),
('wynosi', 'Wartość numeryczna lub wskaźnik'),
('dotyczy', 'Relacja tematyczna lub odniesienie'),
('zawiera', 'Skład lub przynależność elementu'),
('częścią_czegoś', 'Relacja element-całość'),
('rodzaj_czegoś', 'Relacja typ-podtyp'),
('wspiera', 'Pozytywny wpływ lub pomoc'),
('blokuje', 'Negatywny wpływ lub przeszkoda'),
('planuje', 'Zamiar wykonania czynności w przyszłości'),
('wymaga', 'Zależność lub warunek konieczny'),
('pamięta', 'Informacja przechowywana w pamięci'),
('zapomina', 'Utrata informacji lub nawyku'),
('osiąga', 'Realizacja celu lub sukcesu'),
('reaguje_na', 'Reakcja behawioralna lub biologiczna')
ON CONFLICT (relation) DO NOTHING;

-- 3. NORMALIZACJA ISTNIEJĄCYCH RELACJI (Synonimy na Canonical)
UPDATE public.vanguard_entity_links
SET relation = CASE
    WHEN relation IN ('jest_w_stanie', 'ma_stan', 'status', 'is') THEN 'jest'
    WHEN relation IN ('ma', 'ma_filar', 'ma_łącznie', 'has', 'posiada') THEN 'posiada'
    WHEN relation IN ('jest_na_studiach', 'studies', 'studies at') THEN 'studiuje'
    WHEN relation IN ('pracuje_dla', 'pracował', 'pracuje_nad', 'works at') THEN 'pracuje_w'
    WHEN relation IN ('zna', 'kolega', 'przyjaciel', 'friend_of') THEN 'zna_osobę'
    WHEN relation IN ('był_w_związku_z', 'zakochany_w', 'miał_miłość', 'in_relationship_with') THEN 'ma_relację_z'
    WHEN relation IN ('chce_mieć', 'chce_być', 'wants') THEN 'chce'
    WHEN relation IN ('ucieka_w', 'unikanie') THEN 'unika'
    WHEN relation IN ('ma_lęk_przed', 'fears') THEN 'lęka_się'
    WHEN relation IN ('powoduje', 'causes', 'wynik_to') THEN 'prowadzi_do'
    WHEN relation IN ('wynika_z', 'caused_by') THEN 'spowodowane_przez'
    WHEN relation IN ('ma_wskaźnik', 'ma_poziom', 'amounts_to') THEN 'wynosi'
    WHEN relation IN ('był_na_treningu', 'trenuje') THEN 'ćwiczy'
    WHEN relation IN ('uczy_sie', 'learns') THEN 'uczy_się'
    WHEN relation IN ('mówi', 'twierdzi') THEN 'deklaruje'
    WHEN relation IN ('odczuwa') THEN 'czuje'
    ELSE relation
END
WHERE relation NOT IN (SELECT relation FROM public.vanguard_relation_ontology);

-- 4. TRIGGER BLOKUJĄCY RELACJE SPOZA SŁOWNIKA
CREATE OR REPLACE FUNCTION public.check_vanguard_relation_ontology()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.vanguard_relation_ontology WHERE relation = NEW.relation) THEN
        RAISE EXCEPTION 'Relacja "%" nie istnieje w ontologii. Użyj jednej z 35 kanonicznych relacji.', NEW.relation;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_vanguard_relation ON public.vanguard_entity_links;
CREATE TRIGGER trigger_check_vanguard_relation
BEFORE INSERT OR UPDATE ON public.vanguard_entity_links
FOR EACH ROW EXECUTE FUNCTION public.check_vanguard_relation_ontology();
