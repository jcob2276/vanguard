import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { requireServiceRole } from './auth.ts';

const TEST_KEY = 'test-service-key-that-is-long-enough';

function withServiceKey(run: () => void): void {
  const previous = Deno.env.get('SB_SECRET_KEY');
  Deno.env.set('SB_SECRET_KEY', TEST_KEY);
  try {
    run();
  } finally {
    if (previous == null) Deno.env.delete('SB_SECRET_KEY');
    else Deno.env.set('SB_SECRET_KEY', previous);
  }
}

Deno.test('requireServiceRole rejects a request without credentials', () => {
  withServiceKey(() => {
    const response = requireServiceRole(new Request('https://example.test'));
    assertEquals(response?.status, 401);
  });
});

Deno.test('requireServiceRole accepts the legacy bearer transport', () => {
  withServiceKey(() => {
    const request = new Request('https://example.test', {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    assertEquals(requireServiceRole(request), null);
  });
});

Deno.test('requireServiceRole accepts the current apikey transport', () => {
  withServiceKey(() => {
    const request = new Request('https://example.test', {
      headers: { apikey: TEST_KEY },
    });
    assertEquals(requireServiceRole(request), null);
  });
});
