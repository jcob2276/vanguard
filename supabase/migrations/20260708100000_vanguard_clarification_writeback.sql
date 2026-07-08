-- ============================================================
-- VANGUARD OS — FAZA 1.5: CLARIFICATION WRITEBACK TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_clarification_writeback()
RETURNS TRIGGER AS $$
DECLARE
  v_memory_json jsonb;
  v_source text;
  v_relation text;
  v_target text;
  v_source_type text := 'user';
  v_target_type text := 'trait';
  v_deprecated_count integer;
BEGIN
  -- Wykonaj tylko wtedy, gdy status zmienił się na 'answered' z 'pending'
  IF NEW.status = 'answered' AND OLD.status = 'pending' AND NEW.proposed_memory IS NOT NULL AND NEW.proposed_memory <> '' THEN
    -- Sprawdź, czy użytkownik odpowiedział twierdząco ('yes' w tablicy option_ids)
    IF (NEW.answer->'option_ids') ? 'yes' THEN
      -- Próbuj sparsować proposed_memory jako JSON
      BEGIN
        v_memory_json := NEW.proposed_memory::jsonb;
        v_source := v_memory_json->>'source';
        v_relation := v_memory_json->>'relation';
        v_target := v_memory_json->>'target';
        
        IF v_memory_json->>'source_type' IS NOT NULL THEN
          v_source_type := v_memory_json->>'source_type';
        END IF;
        IF v_memory_json->>'target_type' IS NOT NULL THEN
          v_target_type := v_memory_json->>'target_type';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Fallback: jeśli to zwykły tekst
        v_source := 'Jakub';
        v_relation := 'fakt';
        v_target := NEW.proposed_memory;
      END;

      IF v_source IS NOT NULL AND v_relation IS NOT NULL AND v_target IS NOT NULL THEN
        -- Deprecjonowanie starszych, konfliktowych faktów o niższej pewności
        SELECT public.deprecate_superseded_facts(
          NEW.user_id,
          v_source,
          v_relation,
          v_target,
          0.95,
          NULL
        ) INTO v_deprecated_count;

        -- Wstaw nowy aktywny fakt do vanguard_entity_links (co wywoła trigger do claims)
        INSERT INTO public.vanguard_entity_links (
          user_id,
          source_entity,
          relation,
          target_entity,
          source_type,
          target_type,
          confidence_score,
          status,
          temporal_status,
          memory_type,
          metadata
        ) VALUES (
          NEW.user_id,
          v_source,
          v_relation,
          v_target,
          v_source_type,
          v_target_type,
          0.95,
          'active',
          'current',
          'fact',
          jsonb_build_object(
            'source', 'user_confirmed_clarification',
            'clarification_request_id', NEW.id
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usunięcie starego triggera jeśli istnieje
DROP TRIGGER IF EXISTS tr_clarification_writeback ON public.oracle_clarification_requests;

-- Podpięcie triggera AFTER UPDATE
CREATE TRIGGER tr_clarification_writeback
  AFTER UPDATE ON public.oracle_clarification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_clarification_writeback();
