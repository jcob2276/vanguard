/**
 * graphInvariants.ts — Invariant checks for the knowledge graph.
 *
 * Checks derived from real incidents (lessons.md):
 *   - 2026-07-08: merge encji kasujący claims, merged_into bez aliasów
 *   - 2026-07-10: resolution layer hardening (soft-deprecate instead of DELETE)
 *
 * Each violation writes to audit_events, not just console.warn.
 */
import { logAuditEvent } from "../audit.ts";

interface InvariantViolation {
  invariant: string;
  severity: "warning" | "error";
  message: string;
  metadata: Record<string, unknown>;
}

export async function runGraphInvariantCheck(
  supabase: any,
  userId: string,
): Promise<InvariantViolation[]> {
  const violations: InvariantViolation[] = [];

  // ─── 1. Claims pointing to merged entities ───
  const { data: mergedEntities, error: mergedEntitiesError } = await supabase
    .from("entities")
    .select("id, canonical_name, merged_into")
    .eq("user_id", userId)
    .not("merged_into", "is", null);
  if (mergedEntitiesError) throw mergedEntitiesError;

  if (mergedEntities && mergedEntities.length > 0) {
    for (const entity of mergedEntities) {
      const { count, error: claimsCountError } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("subject_id", entity.id)
        .eq("status", "active");
      if (claimsCountError) throw claimsCountError;

      if (count && count > 0) {
        violations.push({
          invariant: "merged_entity_has_active_claims",
          severity: "error",
          message: `Entity "${entity.canonical_name}" has merged_into=${entity.merged_into} but ${count} active claims still reference it`,
          metadata: {
            entity_id: entity.id,
            entity_name: entity.canonical_name,
            merged_into: entity.merged_into,
            active_claims_count: count,
          },
        });
      }
    }
  }

  // ─── 2. Duplicate active claims for same entity+relation ───
  const { data: claims, error: claimsError } = await supabase
    .from("claims")
    .select("id, subject_id, relation_id, object_id, status")
    .eq("user_id", userId)
    .eq("status", "active");
  if (claimsError) throw claimsError;

  if (claims && claims.length > 0) {
    const claimMap = new Map<string, Array<{ id: string; subject_id: string; relation_id: string; object_id: string }>>();
    for (const c of claims) {
      const key = `${c.subject_id}:${c.relation_id}`;
      const existing = claimMap.get(key) || [];
      existing.push(c);
      claimMap.set(key, existing);
    }

    for (const [key, duplicateClaims] of claimMap) {
      if (duplicateClaims.length > 1) {
        const [subjectId, relationId] = key.split(":");
        violations.push({
          invariant: "duplicate_active_claims",
          severity: "warning",
          message: `${duplicateClaims.length} active claims for subject=${subjectId} relation=${relationId}`,
          metadata: {
            subject_id: subjectId,
            relation_id: relationId,
            claim_ids: duplicateClaims.map((c: { id: string }) => c.id),
            object_ids: duplicateClaims.map((c: { object_id: string }) => c.object_id),
          },
        });
      }
    }
  }

  // ─── 3. entity_aliases without winner entity ───
  const { data: userEntities, error: userEntitiesError } = await supabase
    .from("entities")
    .select("id, merged_into")
    .eq("user_id", userId);
  if (userEntitiesError) throw userEntitiesError;

  const userEntityIds = (userEntities || []).map((entity: { id: string }) => entity.id);
  const aliasesResult = userEntityIds.length > 0
    ? await supabase
      .from("entity_aliases")
      .select("id, entity_id, alias")
      .in("entity_id", userEntityIds)
    : { data: [], error: null };
  if (aliasesResult.error) throw aliasesResult.error;
  const aliases = aliasesResult.data;

  if (aliases && aliases.length > 0) {
    const entityMap = new Map((userEntities || []).map((e: { id: string; merged_into: string | null }) => [e.id, e]));

    for (const alias of aliases) {
      const entity = entityMap.get(alias.entity_id) as { id: string; merged_into: string | null } | undefined;
      if (!entity) {
        violations.push({
          invariant: "alias_without_entity",
          severity: "error",
          message: `Alias "${alias.alias}" references non-existent entity ${alias.entity_id}`,
          metadata: { alias_id: alias.id, entity_id: alias.entity_id, alias: alias.alias },
        });
      } else if (entity.merged_into) {
        violations.push({
          invariant: "alias_points_to_merged_entity",
          severity: "warning",
          message: `Alias "${alias.alias}" points to entity that is merged into ${entity.merged_into}`,
          metadata: {
            alias_id: alias.id,
            entity_id: alias.entity_id,
            merged_into: entity.merged_into,
            alias: alias.alias,
          },
        });
      }
    }
  }

  // ─── Log all violations to audit_events ───

  for (const v of violations) {
    await logAuditEvent({
      eventType: `graph_invariant_${v.invariant}`,
      severity: v.severity,
      message: v.message,
      metadata: {
        user_id: userId,
        invariant: v.invariant,
        ...v.metadata,
      },
    }).catch(() => {});
  }

  return violations;
}
