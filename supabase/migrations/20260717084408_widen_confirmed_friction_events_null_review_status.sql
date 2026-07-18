-- review_status is dead since vanguard-friction-qa was removed (last non-NULL write: 2026-05-17).
-- Nothing currently sets it, so the view has silently shown zero rows for 2 months. Widening to
-- also accept NULL trusts the classifier's own extraction (event_kind gate stays) instead of a
-- manual-review step that no longer exists — zero-maintenance per product constitution.
CREATE OR REPLACE VIEW "public"."confirmed_friction_events" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "stream_record_id",
    "occurred_at",
    "raw_text",
    "friction_type",
    "declared_intention",
    "actual_behavior",
    "deviation",
    "immediate_cost",
    "later_cost",
    "cost_estimate",
    "context",
    "emotional_state",
    "people_involved",
    "location_context",
    "confidence_source",
    "confidence",
    "status",
    "created_at",
    "review_status",
    "event_kind",
    "extraction_quality",
    "parser_version",
    "extraction_quality_score",
    "last_reviewed_at",
    "review_notes"
   FROM "public"."friction_events"
  WHERE (("review_status" = ANY (ARRAY['good'::"text", 'user_confirmed'::"text", 'user_corrected'::"text"])) OR ("review_status" IS NULL))
    AND (("event_kind" IS NULL) OR ("event_kind" = ANY (ARRAY['friction_event'::"text", 'positive_micro_action'::"text"])));

ALTER VIEW "public"."confirmed_friction_events" OWNER TO "postgres";

COMMENT ON VIEW "public"."confirmed_friction_events" IS 'High-signal behavioral friction and positive micro-actions. review_status IS NULL accepted since 2026-07-17 — the manual-review pipeline (vanguard-friction-qa) was removed and nothing sets this column anymore; trusting classifier output directly. event_kind IS NULL allowed until legacy-record backfill is complete.';
