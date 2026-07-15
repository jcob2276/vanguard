/**
 * graphInvariants.test.ts
 *
 * Tests the pure logic within runGraphInvariantCheck by using a typed Supabase
 * mock that returns controlled responses. No real DB calls are made.
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { runGraphInvariantCheck } from './graphInvariants.ts';

// ─── minimal Supabase query builder mock ────────────────────────────────────

type MockRow = Record<string, unknown>;

/**
 * Builds a chainable mock that resolves to `{ data, error }`.
 * Supports: .from().select().eq().not().eq()... all chain and resolve at await.
 */
function buildMock(tableResponses: Record<string, MockRow[]>) {
  const handler = (table: string) => {
    const rows = tableResponses[table] ?? [];
    const chain: Record<string, unknown> = {};
    const proxy: Record<string, (..._: unknown[]) => unknown> = {};

    const noop = () => proxyObj;
    const proxyObj = new Proxy(proxy, {
      get(_target, prop) {
        if (prop === 'then') return undefined; // not a promise itself
        if (prop === 'data') return rows;
        if (prop === 'error') return null;
        if (prop === 'count') return rows.length;
        // Terminal awaitable: returns { data, error, count }
        return (..._args: unknown[]) => proxyObj;
      },
    });
    return proxyObj;
  };

  return {
    from: (table: string) => handler(table),
  };
}

// ─── test helpers ────────────────────────────────────────────────────────────

const USER_ID = 'test-user-uuid';

// ─── tests ───────────────────────────────────────────────────────────────────

Deno.test('runGraphInvariantCheck — clean graph returns no violations', async () => {
  // No merged entities, no claims, no aliases → no violations
  const supabase = buildMock({
    entities: [],
    claims: [],
    entity_aliases: [],
  });

  const violations = await runGraphInvariantCheck(supabase as any, USER_ID);
  assertEquals(violations.length, 0);
});

Deno.test('runGraphInvariantCheck — detects duplicate active claims for same subject+relation', async () => {
  const duplicateClaims = [
    { id: 'claim-1', subject_id: 'entity-A', relation_id: 'rel-1', object_id: 'obj-X', status: 'active' },
    { id: 'claim-2', subject_id: 'entity-A', relation_id: 'rel-1', object_id: 'obj-Y', status: 'active' },
    { id: 'claim-3', subject_id: 'entity-B', relation_id: 'rel-2', object_id: 'obj-Z', status: 'active' },
  ];

  const supabase = buildMock({
    entities: [],
    claims: duplicateClaims,
    entity_aliases: [],
  });

  const violations = await runGraphInvariantCheck(supabase as any, USER_ID);
  const dup = violations.find((v) => v.invariant === 'duplicate_active_claims');
  assertEquals(dup !== undefined, true);
  assertEquals((dup!.metadata as Record<string, unknown>).subject_id, 'entity-A');
});

Deno.test('runGraphInvariantCheck — unique subject+relation pairs: no duplicate violation', async () => {
  const claims = [
    { id: 'claim-1', subject_id: 'entity-A', relation_id: 'rel-1', object_id: 'obj-X', status: 'active' },
    { id: 'claim-2', subject_id: 'entity-A', relation_id: 'rel-2', object_id: 'obj-Y', status: 'active' },
    { id: 'claim-3', subject_id: 'entity-B', relation_id: 'rel-1', object_id: 'obj-Z', status: 'active' },
  ];

  const supabase = buildMock({ entities: [], claims, entity_aliases: [] });
  const violations = await runGraphInvariantCheck(supabase as any, USER_ID);
  const dup = violations.find((v) => v.invariant === 'duplicate_active_claims');
  assertEquals(dup, undefined);
});
