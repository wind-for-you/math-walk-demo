/**
 * 带阻尼单摆：θ̈ = -(g/L)sinθ - γω
 * 三个摆同一初始角同时释放，摆球首次进入花瓶碰撞半径即「砸中」。
 */

export const G = 9.8;
/** 线性阻尼系数（s⁻¹），轻阻尼，摆幅可见衰减 */
export const GAMMA = 0.4;
/** 统一释放角（弧度），约 57° */
export const THETA0 = 1.0;

/** 三摆长度（米），下标与支点、颜色一一对应 */
export const PENDULUM_LENGTHS = [2.5, 2.8, 3.1] as const;

/** 三个支点沿 x 排开，同一高度 */
export const PIVOTS = [
  { x: -1.2, y: 3.4 },
  { x: 0, y: 3.4 },
  { x: 1.2, y: 3.4 },
] as const;

/** 花瓶碰撞中心（世界坐标，z=0 平面） */
export const VASE = { x: -0.6, y: 0.8 } as const;

/** 摆球中心与花瓶中心距离 ≤ 该值即命中 */
export const HIT_RADIUS = 0.22;

export const COLORS = ['#4fd1c5', '#f6ad55', '#f687b3'] as const;

/** 模拟步长（秒），240Hz 足够稳定且足够精确 */
export const SMASH_DT = 1 / 240;

export type Vec2 = { x: number; y: number };

export type PendulumState = {
  theta: number;
  omega: number;
  L: number;
};

export type SmashResult = {
  index: number;
  hitTime: number | null;
  length: number;
};

export type SmashSample = {
  t: number;
  states: PendulumState[];
};

export type SmashSimulation = {
  winnerIndex: number | null;
  results: SmashResult[];
  samples: SmashSample[];
  durationSeconds: number;
  dt: number;
};

/**
 * 推进一个时间步（半隐式欧拉），返回新状态，不修改入参。
 */
export function stepPendulum(state: PendulumState, dt: number): PendulumState {
  const alpha =
    -(G / state.L) * Math.sin(state.theta) - GAMMA * state.omega;
  const omega = state.omega + alpha * dt;
  return {
    theta: state.theta + omega * dt,
    omega,
    L: state.L,
  };
}

/** 摆球位置：以支点为圆心、L 为半径的圆弧，θ=0 为最低点 */
export function bobPosition(
  pivot: Vec2,
  length: number,
  theta: number,
): Vec2 {
  return {
    x: pivot.x + length * Math.sin(theta),
    y: pivot.y - length * Math.cos(theta),
  };
}

/** 小角度周期 T ≈ 2π√(L/g) */
export function pendulumPeriod(length: number): number {
  return 2 * Math.PI * Math.sqrt(length / G);
}

/**
 * 从同一初始角释放三摆，积分到 durationSeconds。
 * 记录每摆首次进入花瓶碰撞半径的时间；samples 供场景逐帧插值。
 */
export function simulateSmash(
  durationSeconds: number,
  dt: number,
): SmashSimulation {
  const states: PendulumState[] = PENDULUM_LENGTHS.map((L) => ({
    theta: THETA0,
    omega: 0,
    L,
  }));
  const results: SmashResult[] = PENDULUM_LENGTHS.map((length, index) => ({
    index,
    hitTime: null,
    length,
  }));
  const samples: SmashSample[] = [];
  const steps = Math.max(1, Math.floor(durationSeconds / dt + 1e-9));

  for (let k = 0; k <= steps; k++) {
    const t = k * dt;
    samples.push({ t, states: states.map((s) => ({ ...s })) });

    for (let i = 0; i < states.length; i++) {
      const result = results[i]!;
      if (result.hitTime !== null) continue;
      const bob = bobPosition(
        PIVOTS[i]!,
        states[i]!.L,
        states[i]!.theta,
      );
      const distance = Math.hypot(bob.x - VASE.x, bob.y - VASE.y);
      if (distance <= HIT_RADIUS) result.hitTime = t;
    }

    if (k === steps) break;
    for (let i = 0; i < states.length; i++) {
      states[i] = stepPendulum(states[i]!, dt);
    }
  }

  let winnerIndex: number | null = null;
  let best = Infinity;
  for (const result of results) {
    if (result.hitTime !== null && result.hitTime < best) {
      best = result.hitTime;
      winnerIndex = result.index;
    }
  }

  return { winnerIndex, results, samples, durationSeconds, dt };
}
