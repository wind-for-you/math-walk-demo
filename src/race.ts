import {
  generateWalk,
  DEFAULT_STEPS,
  DEFAULT_STEP_SIZE,
  type WalkResult,
} from './walk';

export const RACE_BALL_COUNT = 3;
export const SHELL_RADIUS = 1.2;
export const BALL_COLORS = ['#4fd1c5', '#f6ad55', '#f687b3'] as const;

export type RaceBallResult = {
  index: number;
  seed: number;
  walk: WalkResult;
  hitStep: number | null; // index into walk.points where radius first crossed
};

export type RaceResult = {
  seed: number;
  balls: RaceBallResult[];
  winnerIndex: number | null; // lowest hitStep; null if none hit
};

function radiusSq(p: { x: number; y: number; z: number }): number {
  return p.x * p.x + p.y * p.y + p.z * p.z;
}

function firstHitStep(walk: WalkResult, r: number): number | null {
  const r2 = r * r;
  for (let i = 0; i < walk.points.length; i++) {
    if (radiusSq(walk.points[i]!) >= r2) return i;
  }
  return null;
}

export function simulateRace(seed: number): RaceResult {
  const balls: RaceBallResult[] = [];
  for (let i = 0; i < RACE_BALL_COUNT; i++) {
    const ballSeed = (seed + i * 0x9e3779b9) >>> 0;
    const walk = generateWalk({
      seed: ballSeed,
      steps: DEFAULT_STEPS,
      stepSize: DEFAULT_STEP_SIZE,
    });
    balls.push({
      index: i,
      seed: ballSeed,
      walk,
      hitStep: firstHitStep(walk, SHELL_RADIUS),
    });
  }
  let winnerIndex: number | null = null;
  let best = Infinity;
  for (const b of balls) {
    if (b.hitStep !== null && b.hitStep < best) {
      best = b.hitStep;
      winnerIndex = b.index;
    }
  }
  return { seed, balls, winnerIndex };
}

/** Map hit step to seconds inside the race phase of length raceDurationSeconds */
export function hitTimeSeconds(
  hitStep: number,
  totalSteps: number,
  raceDurationSeconds: number,
): number {
  const t = (hitStep / Math.max(1, totalSteps)) * raceDurationSeconds;
  return Math.round(t * 10) / 10;
}
