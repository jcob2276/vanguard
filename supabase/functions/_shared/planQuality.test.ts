import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getPlanQualitySignal } from './planQuality.ts';

Deno.test('getPlanQualitySignal — null plan returns unknown/lowQuality', () => {
  const result = getPlanQualitySignal(null);
  assertEquals(result.quality, 'unknown');
  assertEquals(result.isLowQuality, true);
  assertEquals(result.isVeryWeak, true);
  assertEquals(result.isFallback, false);
  assertEquals(result.parseError, false);
});

Deno.test('getPlanQualitySignal — good quality plan', () => {
  const result = getPlanQualitySignal({ plan_quality: 'good' });
  assertEquals(result.quality, 'good');
  assertEquals(result.isLowQuality, false);
  assertEquals(result.isVeryWeak, false);
  assertEquals(result.isFallback, false);
});

Deno.test('getPlanQualitySignal — rescue quality is low quality', () => {
  const result = getPlanQualitySignal({ plan_quality: 'rescue' });
  assertEquals(result.quality, 'rescue');
  assertEquals(result.isLowQuality, true);
  assertEquals(result.isVeryWeak, false);
});

Deno.test('getPlanQualitySignal — minimum quality is very weak', () => {
  const result = getPlanQualitySignal({ plan_quality: 'minimum' });
  assertEquals(result.quality, 'minimum');
  assertEquals(result.isLowQuality, true);
  assertEquals(result.isVeryWeak, true);
});

Deno.test('getPlanQualitySignal — rescue mode triggers low quality even with good plan_quality', () => {
  const result = getPlanQualitySignal({ plan_quality: 'good', mode: 'rescue' });
  assertEquals(result.isLowQuality, true);
  assertEquals(result.mode, 'rescue');
});

Deno.test('getPlanQualitySignal — failure_reason triggers low quality and very weak', () => {
  const result = getPlanQualitySignal({ plan_quality: 'good', plan_failure_reason: 'timeout' });
  assertEquals(result.isLowQuality, true);
  assertEquals(result.isVeryWeak, true);
  assertEquals(result.failureReason, 'timeout');
});

Deno.test('getPlanQualitySignal — fallback flag triggers low quality but not very weak', () => {
  const result = getPlanQualitySignal({ plan_quality: 'good', plan_fallback: true });
  assertEquals(result.isFallback, true);
  assertEquals(result.isLowQuality, true);
  assertEquals(result.isVeryWeak, false);
});

Deno.test('getPlanQualitySignal — parse_error flag is preserved', () => {
  const result = getPlanQualitySignal({ plan_quality: 'good', parse_error: true });
  assertEquals(result.parseError, true);
});

Deno.test('getPlanQualitySignal — missing plan_quality defaults to unknown', () => {
  const result = getPlanQualitySignal({ some_other_field: true });
  assertEquals(result.quality, 'unknown');
});
