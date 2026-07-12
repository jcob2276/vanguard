-- ============================================================
-- VANGUARD OS — FIX §1.1: CHOICE CLARIFICATION WRITEBACK
-- ============================================================
-- Refines handle_clarification_writeback() to ensure that negative
-- user responses (e.g. choosing 'no', 'nie', or 'false' options) in
-- single_choice or multi_choice formats do not trigger a writeback.
-- Previously, any choice that was not uncertainty ('__uncertain__')
-- was treated as affirmative.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_clarification_writeback()
RETURNS TRIGGER AS $$
DECLARE
  v_memory_json    jsonb;
  v_source         text;
  v_relation       text;
  v_target         text;
  v_source_type    text := 'user';
  v_target_type    text := 'trait';
  v_deprecated_cnt integer;
  v_answer_obj     jsonb;
  v_confirmed      boolean := false;
BEGIN
  -- Only act when status transitions pending → answered with proposed_memory set
  IF NOT (
    NEW.status = 'answered'
    AND OLD.status = 'pending'
    AND NEW.proposed_memory IS NOT NULL
    AND NEW.proposed_memory <> ''
  ) THEN
    RETURN NEW;
  END IF;

  -- Parse the answer JSON safely
  BEGIN
    v_answer_obj := NEW.answer::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[writeback] Cannot parse answer as JSON for clarification %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- Do not write if user expressed uncertainty
  IF coalesce((v_answer_obj->>'is_uncertain')::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- Determine whether the answer is affirmative, per response_type:
  --   confirm      → option_ids contains 'yes'
  --   single_choice/multi_choice → option_ids is non-empty and does NOT contain '__uncertain__', 'no', 'nie', 'false'
  --   short_text   → text field is non-empty
  IF NEW.response_type = 'confirm' THEN
    v_confirmed := (v_answer_obj->'option_ids') ? 'yes';

  ELSIF NEW.response_type IN ('single_choice', 'multi_choice') THEN
    v_confirmed :=
      jsonb_typeof(v_answer_obj->'option_ids') = 'array'
      AND jsonb_array_length(v_answer_obj->'option_ids') > 0
      AND NOT ((v_answer_obj->'option_ids') ? '__uncertain__')
      AND NOT ((v_answer_obj->'option_ids') ? 'no')
      AND NOT ((v_answer_obj->'option_ids') ? 'nie')
      AND NOT ((v_answer_obj->'option_ids') ? 'false');

  ELSIF NEW.response_type = 'short_text' THEN
    v_confirmed :=
      (v_answer_obj->>'text') IS NOT NULL
      AND (v_answer_obj->>'text') <> '';
  END IF;

  IF NOT v_confirmed THEN
    RETURN NEW;
  END IF;

  -- Parse proposed_memory (must be valid JSON with source/relation/target)
  BEGIN
    v_memory_json := NEW.proposed_memory::jsonb;
    v_source      := v_memory_json->>'source';
    v_relation    := v_memory_json->>'relation';
    v_target      := v_memory_json->>'target';

    IF (v_memory_json->>'source_type') IS NOT NULL THEN
      v_source_type := v_memory_json->>'source_type';
    END IF;
    IF (v_memory_json->>'target_type') IS NOT NULL THEN
      v_target_type := v_memory_json->>'target_type';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- proposed_memory was plain text, not a triad JSON — skip writeback
    RAISE WARNING '[writeback] proposed_memory is not valid JSON for clarification %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  IF v_source IS NULL OR v_relation IS NULL OR v_target IS NULL THEN
    RAISE WARNING '[writeback] Incomplete proposed_memory triad (source/relation/target) for clarification %', NEW.id;
    RETURN NEW;
  END IF;

  -- Deprecate conflicting singleton facts (best-effort, non-fatal)
  BEGIN
    SELECT public.deprecate_superseded_facts(
      NEW.user_id,
      v_source,
      v_relation,
      v_target,
      0.95,
      NULL
    ) INTO v_deprecated_cnt;
    RAISE LOG '[writeback] Deprecated % conflicting fact(s) for clarification %', v_deprecated_cnt, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[writeback] deprecate_superseded_facts failed (non-fatal) for clarification %: %', NEW.id, SQLERRM;
  END;

  -- Insert confirmed fact into knowledge graph (non-fatal on FK / ontology violation)
  BEGIN
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
        'source',                    'user_confirmed_clarification',
        'clarification_request_id',  NEW.id,
        'response_type',             NEW.response_type
      )
    );
    RAISE LOG '[writeback] Inserted entity link: % -[%]-> % (clarification %)',
      v_source, v_relation, v_target, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Relation not in ontology, or other constraint violation — log and continue.
    RAISE WARNING '[writeback] INSERT vanguard_entity_links failed for clarification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_clarification_writeback ON public.oracle_clarification_requests;

CREATE TRIGGER tr_clarification_writeback
  AFTER UPDATE ON public.oracle_clarification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_clarification_writeback();
