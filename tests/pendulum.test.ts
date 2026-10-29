import { describe, it, expect } from 'vitest';
import {
  COLORS,
  G,
  GAMMA,
  HIT_RADIUS,
  PENDULUM_LENGTHS,
  PIVOTS,
  THETA0,
  VASE,
  bobPosition,
  pendulumPeriod,
  simulateSmash,
  stepPendulum,
  type SmashSimulation,
} from '../src/pendulum';

const DT = 1 / 240;
const DURATION = 2.4;

function sampleAt(sim: SmashSimulation, t: number) {
  const sample = sim.samples.find((s) => Math.abs(s.t - t) < 1e-9);
  if (!sample) throw new Error(`no sample at ${t}`);
  return sample;
}

describe('常量', () => {
  it('三摆长度递增，支点与颜色一一对应', () => {
    expect(PENDULUM_LENGTHS).toHaveLength(3);
    expect(PENDULUM_LENGTHS[0]).toBeLessThan(PENDULUM_LENGTHS[1]);
    expect(PENDULUM_LENGTHS[1]).toBeLessThan(PENDULUM_LENGTHS[2]);
    expect(COLORS).toHaveLength(3);
    expect(PIVOTS).toHaveLength(3);
  });

  it('物理参数与目标位置固定', () => {
    expect(G).toBe(9.8);
    expect(GAMMA).toBeGreaterThan(0);
    expect(THETA0).toBeGreaterThan(0);
    expect(HIT_RADIUS).toBeGreaterThan(0);
    expect(Number.isFinite(VASE.x)).toBe(true);
    expect(Number.isFinite(VASE.y)).toBe(true);
  });
});

describe('stepPendulum', () => {
  it('竖直静止时保持静止', () => {
    const s0 = { theta: 0, omega: 0, L: PENDULUM_LENGTHS[0] };
    const s1 = stepPendulum(s0, 0.01);
    expect(s1.theta).toBeCloseTo(0, 10);
    expect(s1.omega).toBeCloseTo(0, 10);
  });

  it('从释放角开始向平衡位置加速', () => {
    const s0 = { theta: THETA0, omega: 0, L: PENDULUM_LENGTHS[0] };
    const s1 = stepPendulum(s0, 0.01);
    expect(s1.theta).toBeLessThan(THETA0);
    expect(s1.omega).toBeLessThan(0);
  });

  it('不修改传入状态，并保留长度', () => {
    const s0 = { theta: THETA0, omega: 0, L: PENDULUM_LENGTHS[1] };
    const s1 = stepPendulum(s0, 0.01);
    expect(s0).toEqual({ theta: THETA0, omega: 0, L: PENDULUM_LENGTHS[1] });
    expect(s1.L).toBe(PENDULUM_LENGTHS[1]);
  });

  it('阻尼让摆幅衰减：第一个回摆最高点低于释放角', () => {
    let s = { theta: THETA0, omega: 0, L: PENDULUM_LENGTHS[0] };
    let prevOmega = s.omega;
    let firstTurn: number | null = null;
    for (let i = 0; i < 240 * 3; i++) {
      const next = stepPendulum(s, DT);
      if (prevOmega < 0 && next.omega >= 0) {
        firstTurn = next.theta;
        break;
      }
      prevOmega = next.omega;
      s = next;
    }
    expect(firstTurn).not.toBeNull();
    expect(Math.abs(firstTurn!)).toBeLessThan(THETA0);
    expect(Math.abs(firstTurn!)).toBeGreaterThan(THETA0 * 0.5);
  });
});

describe('bobPosition', () => {
  it('θ=0 时位于支点正下方 L 处', () => {
    expect(bobPosition({ x: 1, y: 3 }, 2, 0)).toEqual({ x: 1, y: 1 });
  });

  it('θ=π/2 时位于支点右侧 L 处', () => {
    const p = bobPosition({ x: 0, y: 3 }, 2, Math.PI / 2);
    expect(p.x).toBeCloseTo(2, 10);
    expect(p.y).toBeCloseTo(3, 10);
  });
});

describe('pendulumPeriod', () => {
  it('小角度周期 T≈2π√(L/g)', () => {
    for (const L of PENDULUM_LENGTHS) {
      expect(pendulumPeriod(L)).toBeCloseTo(2 * Math.PI * Math.sqrt(L / G), 10);
    }
  });

  it('摆越长周期越长', () => {
    expect(pendulumPeriod(PENDULUM_LENGTHS[0])).toBeLessThan(
      pendulumPeriod(PENDULUM_LENGTHS[2]),
    );
  });
});

describe('simulateSmash', () => {
  const sim = simulateSmash(DURATION, DT);

  it('同参数完全确定', () => {
    const again = simulateSmash(DURATION, DT);
    expect(again.winnerIndex).toBe(sim.winnerIndex);
    expect(again.results.map((r) => r.hitTime)).toEqual(
      sim.results.map((r) => r.hitTime),
    );
    expect(again.samples.length).toBe(sim.samples.length);
  });

  it('三摆都在赛程内砸中，短摆先中', () => {
    expect(sim.results).toHaveLength(3);
    for (const r of sim.results) expect(r.hitTime).not.toBeNull();
    const times = sim.results.map((r) => r.hitTime!);
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
    expect(times[2]).toBeLessThanOrEqual(DURATION);
    expect(sim.results.map((r) => r.length)).toEqual([...PENDULUM_LENGTHS]);
    expect(sim.winnerIndex).toBe(0);
  });

  it('命中时刻摆球确实进入花瓶碰撞半径', () => {
    for (const r of sim.results) {
      const sample = sampleAt(sim, r.hitTime!);
      const bob = bobPosition(
        PIVOTS[r.index]!,
        r.length,
        sample.states[r.index]!.theta,
      );
      const d = Math.hypot(bob.x - VASE.x, bob.y - VASE.y);
      expect(d).toBeLessThanOrEqual(HIT_RADIUS + 1e-9);
    }
  });

  it('samples 从 0 覆盖到时程末尾，步长固定', () => {
    expect(sim.samples[0]!.t).toBe(0);
    expect(sim.samples[sim.samples.length - 1]!.t).toBeCloseTo(DURATION, 9);
    for (let i = 1; i < sim.samples.length; i++) {
      expect(sim.samples[i]!.t - sim.samples[i - 1]!.t).toBeCloseTo(DT, 9);
    }
    expect(sim.durationSeconds).toBe(DURATION);
    expect(sim.dt).toBe(DT);
  });
});
