export const IOS_SPRING = {
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  interactive: { type: 'spring', bounce: 0.2, duration: 0.32 },
  sheet: { type: 'spring', bounce: 0.18, duration: 0.3 },
} as const;

export function projectMomentum(velocity: number, decelerationRate = 0.998) {
  if (decelerationRate <= 0 || decelerationRate >= 1) return 0;
  return (velocity / 1_000) * decelerationRate / (1 - decelerationRate);
}

export function nearestSnapPoint(position: number, snapPoints: readonly number[]) {
  if (snapPoints.length === 0) return position;
  return snapPoints.reduce((nearest, point) => (
    Math.abs(point - position) < Math.abs(nearest - position) ? point : nearest
  ));
}

export function rubberBand(overshoot: number, dimension: number, constant = 0.55) {
  if (dimension <= 0 || overshoot === 0) return 0;
  return (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot));
}

interface GestureCommitInput {
  distance: number;
  velocity: number;
  dimension: number;
  distanceRatio?: number;
  velocityThreshold?: number;
}

export function shouldCommitGesture({
  distance,
  velocity,
  dimension,
  distanceRatio = 0.16,
  velocityThreshold = 520,
}: GestureCommitInput) {
  return Math.abs(distance) >= dimension * distanceRatio ||
    Math.abs(velocity) >= velocityThreshold;
}
