-- Medical context layer: lab markers, source documents, and body composition snapshots.
-- This stores facts from provided documents without turning them into diagnoses.

CREATE TABLE IF NOT EXISTS medical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_date date NOT NULL,
  document_type text NOT NULL,
  source_name text NOT NULL,
  source_path text,
  provider text,
  clinical_validity text NOT NULL DEFAULT 'clinical',
  summary text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_name, document_date)
);

ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "md_select" ON medical_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "md_insert" ON medical_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "md_update" ON medical_documents FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS medical_lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result_date date NOT NULL,
  marker_key text NOT NULL,
  marker_name text NOT NULL,
  category text,
  value numeric NOT NULL,
  unit text,
  ref_low numeric,
  ref_high numeric,
  ref_text text,
  flag text,
  source_name text NOT NULL,
  provider text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, result_date, marker_key, source_name)
);

ALTER TABLE medical_lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlr_select" ON medical_lab_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mlr_insert" ON medical_lab_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mlr_update" ON medical_lab_results FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_medical_lab_results_user_date
  ON medical_lab_results (user_id, result_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_lab_results_marker
  ON medical_lab_results (user_id, marker_key, result_date DESC);

CREATE TABLE IF NOT EXISTS body_composition_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  source text NOT NULL,
  method text NOT NULL DEFAULT 'BIA',
  reliability text NOT NULL DEFAULT 'estimated',
  weight_kg numeric,
  body_fat_pct numeric,
  fat_mass_kg numeric,
  fat_free_mass_kg numeric,
  muscle_mass_kg numeric,
  bone_mass_kg numeric,
  protein_kg numeric,
  total_body_water_kg numeric,
  total_body_water_pct numeric,
  extracellular_water_kg numeric,
  intracellular_water_kg numeric,
  visceral_fat_rating numeric,
  bmi numeric,
  metabolic_age numeric,
  bmr_kcal numeric,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, measured_at, source)
);

ALTER TABLE body_composition_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bcm_select" ON body_composition_measurements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bcm_insert" ON body_composition_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bcm_update" ON body_composition_measurements FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_composition_measurements_user_date
  ON body_composition_measurements (user_id, measured_at DESC);

DROP TRIGGER IF EXISTS trg_medical_documents_updated_at ON medical_documents;
CREATE TRIGGER trg_medical_documents_updated_at
  BEFORE UPDATE ON medical_documents
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_medical_lab_results_updated_at ON medical_lab_results;
CREATE TRIGGER trg_medical_lab_results_updated_at
  BEFORE UPDATE ON medical_lab_results
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_body_composition_measurements_updated_at ON body_composition_measurements;
CREATE TRIGGER trg_body_composition_measurements_updated_at
  BEFORE UPDATE ON body_composition_measurements
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Source documents from local medical document archive
INSERT INTO medical_documents (
  user_id, document_date, document_type, source_name, source_path, provider,
  clinical_validity, summary, notes
) VALUES
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2022-07-19', 'laryngoscopy_images',
    'USG Krtani 19 lipiec 2022.pdf',
    'USG Krtani 19 lipiec 2022.pdf',
    'Wojewodzki Szpital Podkarpacki im. Jana Pawla II w Krosnie',
    'clinical_document',
    'Endoskopowe obrazy krtani z oddzialu laryngologii; brak liczbowych markerow laboratoryjnych.',
    'Dokument obrazowy. Nie importowano markerow liczbowych; interpretacja wymaga lekarza.'
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2022-09-05', 'non_clinical_analysis_report',
    'Jakub Sobon.htm',
    'Jakub Sobon.htm',
    'Unknown analyzer',
    'non_clinical_low_confidence',
    'Raport HTML z parametrami typu "gestosc krwi", "energia qi" i kategoriami spoza standardowej diagnostyki laboratoryjnej.',
    'Zachowane jako dokument historyczny. Nie uzywac jako klinicznych biomarkerow ani do decyzji medycznych.'
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2022-12-10', 'body_composition_bia',
    'Body analizer.jpg',
    'Body analizer.jpg',
    'Tanita MC-980 / MC-780',
    'estimated_bia',
    'Pomiar skladu ciala BIA: masa 66.8 kg, BF 15.8%, masa tluszczu 10.6 kg, FFM 56.2 kg, muscle mass 53.4 kg.',
    'BIA/Tanita: dobry trend historyczny, ale nie traktowac jak DEXA.'
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2023-02-09', 'hematology_referral',
    '9 luty 2023 - Ferrytyna .pdf',
    '9 luty 2023 - Ferrytyna .pdf',
    'Prywatny Gabinet Hematologiczny Beata Kumiega',
    'clinical_document',
    'Zlecenie diagnostyki hematologicznej: morfologia, ferrytyna, wysycenie transferryny.',
    'To jest skierowanie/zlecenie, nie wynik liczbowy.'
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2024-11-13', 'laboratory_report',
    'Testosteron listopad 23.pdf',
    'Testosteron listopad 23.pdf',
    'ALAB laboratoria',
    'clinical_lab',
    'Testosteron calkowity: 7.17 ng/mL.',
    NULL
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2024-12-30', 'laboratory_report',
    'Ferrytyna 30.12.2024.pdf',
    'Ferrytyna 30.12.2024.pdf',
    'Diagnostyka',
    'clinical_lab',
    'Ferrytyna: 213.05 ng/ml.',
    NULL
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'laboratory_report',
    'Pakiet 20+.pdf',
    'Pakiet 20+.pdf',
    'ALAB laboratoria',
    'clinical_lab',
    'Pakiet 20+: morfologia, glukoza, lipidogram, magnez, TSH, testosteron, witamina D.',
    NULL
  ),
  (
    NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-11-09', 'non_clinical_analysis_report',
    'Sprawozdanie z badanKuba Sobon.htm',
    'Sprawozdanie z badańKuba Sobon.htm',
    'Unknown analyzer',
    'non_clinical_low_confidence',
    'Raport HTML z parametrami spoza standardowej diagnostyki laboratoryjnej.',
    'Zachowane jako dokument historyczny. Nie uzywac jako klinicznych biomarkerow ani do decyzji medycznych.'
  )
ON CONFLICT (user_id, source_name, document_date) DO UPDATE SET
  document_type = EXCLUDED.document_type,
  source_path = EXCLUDED.source_path,
  provider = EXCLUDED.provider,
  clinical_validity = EXCLUDED.clinical_validity,
  summary = EXCLUDED.summary,
  notes = EXCLUDED.notes;

INSERT INTO medical_lab_results (
  user_id, result_date, marker_key, marker_name, category, value, unit,
  ref_low, ref_high, ref_text, flag, source_name, provider, notes
) VALUES
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2024-11-13', 'testosterone_total', 'Testosteron calkowity', 'hormones', 7.17, 'ng/mL', 2.40, 8.71, '2.40-8.71', NULL, 'Testosteron listopad 23.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2024-12-30', 'ferritin', 'Ferrytyna', 'iron_status', 213.05, 'ng/ml', 21.81, 274.66, '21.81-274.66', NULL, 'Ferrytyna 30.12.2024.pdf', 'Diagnostyka', NULL),

  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'wbc', 'Leukocyty (WBC)', 'hematology', 5.78, '10^9/L', 4.0, 10.0, '4.0-10.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'neutrophils_abs', 'Neutrocyty (NEU)', 'hematology', 2.11, '10^9/L', 1.9, 7.0, '1.9-7.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'lymphocytes_abs', 'Limfocyty (LYMPH)', 'hematology', 2.85, '10^9/L', 1.5, 4.5, '1.5-4.5', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'monocytes_abs', 'Monocyty (MON)', 'hematology', 0.58, '10^9/L', 0.1, 0.9, '0.1-0.9', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'eosinophils_abs', 'Eozynocyty (EOS)', 'hematology', 0.20, '10^9/L', 0.05, 0.50, '0.05-0.50', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'basophils_abs', 'Bazocyty (BASO)', 'hematology', 0.04, '10^9/L', 0.00, 0.10, '0.00-0.10', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'neutrophils_pct', 'Neutrocyty (NEU%)', 'hematology', 36.5, '%', 45.0, 70.0, '45.0-70.0', 'low', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'lymphocytes_pct', 'Limfocyty (LYMPH%)', 'hematology', 49.3, '%', 25.0, 45.0, '25.0-45.0', 'high', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'monocytes_pct', 'Monocyty (MON%)', 'hematology', 10.0, '%', 2.0, 9.0, '2.0-9.0', 'high', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'eosinophils_pct', 'Eozynocyty (EOS%)', 'hematology', 3.4, '%', 0.0, 5.0, '0.0-5.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'basophils_pct', 'Bazocyty (BASO%)', 'hematology', 0.70, '%', 0.00, 1.00, '0.00-1.00', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'rbc', 'Erytrocyty (RBC)', 'hematology', 5.39, '10^12/L', 4.6, 6.5, '4.6-6.5', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'hemoglobin', 'Hemoglobina (HGB)', 'hematology', 16.2, 'g/dL', 13.5, 18.0, '13.5-18.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'hematocrit', 'Hematokryt (HCT)', 'hematology', 48.0, '%', 40.0, 52.0, '40.0-52.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'mcv', 'Srednia objetosc erytrocyta (MCV)', 'hematology', 89.1, 'fL', 80.0, 98.0, '80.0-98.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'mch', 'Srednia masa HGB w erytrocycie (MCH)', 'hematology', 30.1, 'pg', 27.0, 32.0, '27.0-32.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'mchc', 'Srednie stezenie HGB w erytrocytach (MCHC)', 'hematology', 33.8, 'g/dL', 31.0, 37.0, '31.0-37.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'rdw', 'Wskaznik anizocytozy erytrocytow (RDW)', 'hematology', 13.4, '%', 11.5, 14.5, '11.5-14.5', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'platelets', 'Plytki krwi (PLT)', 'hematology', 197, '10^9/L', 150, 400, '150-400', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'pct', 'Plytkokryt (PCT)', 'hematology', 0.21, '%', 0.12, 0.36, '0.12-0.36', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'pdw', 'Wskaznik anizocytozy plytek krwi (PDW)', 'hematology', 19.2, '%', 11.0, 18.0, '11.0-18.0', 'high', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'mpv', 'Srednia objetosc plytek krwi (MPV)', 'hematology', 10.6, 'fL', 7.0, 12.0, '7.0-12.0', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),

  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'glucose', 'Glukoza', 'metabolic', 76, 'mg/dL', 70, 99, '70-99', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'cholesterol_total', 'Cholesterol calkowity', 'lipids', 201, 'mg/dL', NULL, 190, '<190', 'high', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'triglycerides', 'Triglicerydy', 'lipids', 47, 'mg/dL', NULL, 100, '<100 fasting / <125 non-fasting', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'hdl_cholesterol', 'Cholesterol HDL', 'lipids', 59, 'mg/dL', 40, NULL, '>40', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'ldl_cholesterol_calculated', 'Cholesterol LDL wyliczony', 'lipids', 132, 'mg/dL', NULL, NULL, 'Targets depend on cardiovascular risk; lab notes <115 mg/dL for low risk.', 'above_low_risk_target', 'Pakiet 20+.pdf', 'ALAB laboratoria', 'Wyliczony wzorem Friedewalda.'),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'non_hdl_cholesterol', 'Nie-HDL', 'lipids', 142, 'mg/dL', NULL, NULL, 'Targets depend on cardiovascular risk; lab notes <130 mg/dL for low/moderate risk.', 'above_low_risk_target', 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'magnesium_serum', 'Magnez w surowicy', 'minerals', 1.69, 'mg/dL', 1.60, 2.60, '1.60-2.60', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'tsh', 'Tyreotropina (TSH) trzeciej generacji', 'thyroid', 4.337, 'uIU/mL', 0.350, 4.940, '0.350-4.940', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', 'W zakresie referencyjnym laboratorium, blisko gornej granicy.'),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'testosterone_total', 'Testosteron calkowity', 'hormones', 7.30, 'ng/mL', 2.40, 8.71, '2.40-8.71', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL),
  (NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid, '2025-04-25', 'vitamin_d_25oh', 'Witamina 25(OH)D Total', 'vitamins', 46, 'ng/mL', 30, 100, 'Sufficient 30-100; deficiency <10; insufficient 10-30; toxicity >100', NULL, 'Pakiet 20+.pdf', 'ALAB laboratoria', NULL)
ON CONFLICT (user_id, result_date, marker_key, source_name) DO UPDATE SET
  marker_name = EXCLUDED.marker_name,
  category = EXCLUDED.category,
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  ref_low = EXCLUDED.ref_low,
  ref_high = EXCLUDED.ref_high,
  ref_text = EXCLUDED.ref_text,
  flag = EXCLUDED.flag,
  provider = EXCLUDED.provider,
  notes = EXCLUDED.notes;

INSERT INTO body_composition_measurements (
  user_id, measured_at, source, method, reliability,
  weight_kg, body_fat_pct, fat_mass_kg, fat_free_mass_kg, muscle_mass_kg,
  bone_mass_kg, protein_kg, total_body_water_kg, total_body_water_pct,
  extracellular_water_kg, intracellular_water_kg, visceral_fat_rating,
  bmi, metabolic_age, bmr_kcal, raw, notes
) VALUES (
  NULLIF(current_setting('app.vanguard_user_id', true), '')::uuid,
  '2022-12-10 17:50:00+01',
  'Body analizer.jpg',
  'Tanita MC-980 / MC-780 BIA',
  'estimated',
  66.8, 15.8, 10.6, 56.2, 53.4,
  2.8, 11.2, 42.2, 63.2,
  16.7, 25.5, 2,
  24.0, 15, 1681,
  '{
    "height_cm": 167.0,
    "age": 20,
    "sex": "male",
    "physique_rating": "standard muscular/athletic area on Tanita chart",
    "segmental_muscle_mass_kg": {
      "trunk": 27.3,
      "left_arm": 3.1,
      "right_arm": 3.2,
      "left_leg": 9.7,
      "right_leg": 10.1
    },
    "segmental_fat": {
      "trunk_pct": 19.2,
      "trunk_kg": 6.6,
      "left_arm_pct": 14.9,
      "left_arm_kg": 0.6,
      "right_arm_pct": 14.0,
      "right_arm_kg": 0.6,
      "left_leg_pct": 11.6,
      "left_leg_kg": 1.3,
      "right_leg_pct": 11.1,
      "right_leg_kg": 1.3
    }
  }'::jsonb,
  'BIA/Tanita snapshot; use for trend/context, not as diagnostic body-fat truth.'
)
ON CONFLICT (user_id, measured_at, source) DO UPDATE SET
  method = EXCLUDED.method,
  reliability = EXCLUDED.reliability,
  weight_kg = EXCLUDED.weight_kg,
  body_fat_pct = EXCLUDED.body_fat_pct,
  fat_mass_kg = EXCLUDED.fat_mass_kg,
  fat_free_mass_kg = EXCLUDED.fat_free_mass_kg,
  muscle_mass_kg = EXCLUDED.muscle_mass_kg,
  bone_mass_kg = EXCLUDED.bone_mass_kg,
  protein_kg = EXCLUDED.protein_kg,
  total_body_water_kg = EXCLUDED.total_body_water_kg,
  total_body_water_pct = EXCLUDED.total_body_water_pct,
  extracellular_water_kg = EXCLUDED.extracellular_water_kg,
  intracellular_water_kg = EXCLUDED.intracellular_water_kg,
  visceral_fat_rating = EXCLUDED.visceral_fat_rating,
  bmi = EXCLUDED.bmi,
  metabolic_age = EXCLUDED.metabolic_age,
  bmr_kcal = EXCLUDED.bmr_kcal,
  raw = EXCLUDED.raw,
  notes = EXCLUDED.notes;
