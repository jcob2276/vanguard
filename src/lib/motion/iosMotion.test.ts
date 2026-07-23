import { describe, expect, it } from 'vitest';
import {
  nearestSnapPoint,
  projectMomentum,
  rubberBand,
  shouldCommitGesture,
} from './iosMotion';

describe('iOS motion primitives', () => {
  it('projects a release velocity using exponential deceleration', () => {
    expect(projectMomentum(1_000, 0.99)).toBeCloseTo(99, 5);
    expect(projectMomentum(-1_000, 0.99)).toBeCloseTo(-99, 5);
  });

  it('chooses the snap point nearest the projected endpoint', () => {
    expect(nearestSnapPoint(620, [0, 400, 800])).toBe(800);
    expect(nearestSnapPoint(490, [0, 400, 800])).toBe(400);
  });

  it('adds progressively less movement beyond a boundary', () => {
    expect(rubberBand(0, 800)).toBe(0);
    expect(rubberBand(100, 800)).toBeGreaterThan(0);
    expect(rubberBand(200, 800)).toBeLessThan(rubberBand(100, 800) * 2);
    expect(rubberBand(-100, 800)).toBeLessThan(0);
  });

  it('commits a gesture from either sufficient distance or velocity', () => {
    expect(shouldCommitGesture({ distance: 80, velocity: 50, dimension: 390 })).toBe(true);
    expect(shouldCommitGesture({ distance: 10, velocity: 700, dimension: 390 })).toBe(true);
    expect(shouldCommitGesture({ distance: 10, velocity: 50, dimension: 390 })).toBe(false);
  });
});
