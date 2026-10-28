import { describe, it, expect } from 'vitest';
import {
  generateWalk,
  DEFAULT_STEPS,
  DEFAULT_STEP_SIZE,
  type Vec3,
} from '../src/walk';

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

describe('generateWalk', () => {
  it('默认常量符合 Global Constraints', () => {
    expect(DEFAULT_STEPS).toBe(320);
    expect(DEFAULT_STEP_SIZE).toBe(0.08);
  });

  it('点数 = steps + 1（含起点）', () => {
    const w = generateWalk({ seed: 7, steps: 10, stepSize: 0.08 });
    expect(w.points).toHaveLength(11);
    expect(w.points[0]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('每步恰好沿一轴移动 stepSize', () => {
    const stepSize = 0.08;
    const w = generateWalk({ seed: 99, steps: 50, stepSize });
    for (let i = 1; i < w.points.length; i++) {
      const a = w.points[i - 1]!;
      const b = w.points[i]!;
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const dz = Math.abs(b.z - a.z);
      const axesMoved =
        (dx > 1e-12 ? 1 : 0) + (dy > 1e-12 ? 1 : 0) + (dz > 1e-12 ? 1 : 0);
      expect(axesMoved).toBe(1);
      expect(Math.max(dx, dy, dz)).toBeCloseTo(stepSize, 10);
    }
  });

  it('pathLength = steps * stepSize', () => {
    const steps = 40;
    const stepSize = 0.08;
    const w = generateWalk({ seed: 1, steps, stepSize });
    expect(w.pathLength).toBeCloseTo(steps * stepSize, 10);
  });

  it('displacement = |终点 − 起点|', () => {
    const w = generateWalk({ seed: 3, steps: 80, stepSize: 0.08 });
    const start = w.points[0]!;
    const end = w.points[w.points.length - 1]!;
    expect(w.displacement).toBeCloseTo(dist(start, end), 10);
  });

  it('同一 seed 可复现整条路径', () => {
    const a = generateWalk({ seed: 42, steps: 100, stepSize: 0.08 });
    const b = generateWalk({ seed: 42, steps: 100, stepSize: 0.08 });
    expect(a.points).toEqual(b.points);
    expect(a.pathLength).toBe(b.pathLength);
    expect(a.displacement).toBe(b.displacement);
  });

  it('不同 seed 路径不同', () => {
    const a = generateWalk({ seed: 1, steps: 100, stepSize: 0.08 });
    const b = generateWalk({ seed: 2, steps: 100, stepSize: 0.08 });
    expect(a.points).not.toEqual(b.points);
  });

  it('结果带回 seed', () => {
    const w = generateWalk({ seed: 55, steps: 5, stepSize: 0.08 });
    expect(w.seed).toBe(55);
  });
});
