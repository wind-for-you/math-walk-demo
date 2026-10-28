import { createRng } from './rng';

export type Vec3 = { x: number; y: number; z: number };

export type WalkConfig = {
  seed: number;
  steps: number;
  stepSize: number;
};

export type WalkResult = {
  points: Vec3[];
  pathLength: number;
  displacement: number;
  seed: number;
};

export const DEFAULT_STEPS = 320;
export const DEFAULT_STEP_SIZE = 0.08;

const DIRS: ReadonlyArray<Vec3> = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

export function generateWalk(config: WalkConfig): WalkResult {
  const { seed, steps, stepSize } = config;
  const rng = createRng(seed);
  const points: Vec3[] = [{ x: 0, y: 0, z: 0 }];

  for (let i = 0; i < steps; i++) {
    const dir = DIRS[Math.floor(rng() * 6)]!;
    const prev = points[points.length - 1]!;
    points.push({
      x: prev.x + dir.x * stepSize,
      y: prev.y + dir.y * stepSize,
      z: prev.z + dir.z * stepSize,
    });
  }

  const start = points[0]!;
  const end = points[points.length - 1]!;
  const displacement = Math.hypot(
    end.x - start.x,
    end.y - start.y,
    end.z - start.z,
  );

  return {
    points,
    pathLength: steps * stepSize,
    displacement,
    seed,
  };
}
