# 随机游走 3D 演示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可自动循环播放的三维轴对齐随机游走单页演示：粒子 + 轨迹丝带 + 路径/位移对比，服务竖屏短视频录制，同一 seed 可复现。

**Architecture:** Vite + TypeScript 单页应用；纯逻辑模块（rng / walk / timeline）与 Three.js 场景（scene）分离；main 接线时间轴、URL seed、HUD 与交互；export-hints 负责竖屏安全区与构图提示。渲染用 requestAnimationFrame，时间轴为 intro → walk → compare → reset 轻量状态机。

**Tech Stack:** Vite + TypeScript + Three.js + Vitest

## Global Constraints

- 单圈循环锚定 **24 秒**：intro 0–2s → walk 2–18s → compare 18–22s → reset 22–24s，然后无缝重播。
- 模型：三维 **轴对齐** 简单随机游走；每步从六方向（±x、±y、±z）等概率选取。
- 默认步数 **N = 320**（可配置范围 200–400）；默认步长 **stepSize = 0.08**。
- 路径长度 = N × stepSize；位移 = |终点 − 起点|。
- 可种子 PRNG（mulberry32）；同一 seed 轨迹与镜头表现可复现。
- URL `?seed=42` 锁定 seed；自动循环每圈使用新 seed；点击或空格 = 换种子重跑。
- 默认构图竖屏 **9:16**；文案置于上下安全区；桌面可横屏预览。
- 第一版 **不做**：多粒子扩散云、障碍碰撞、关卡得分、后端、登录、MediaRecorder、音效、扩散方程公式墙。
- 纯逻辑用 Vitest；Three 场景以手动浏览器验收。

---

## File Structure

```
math-walk-demo/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  README.md
  src/
    rng.ts            # 可种子 PRNG（mulberry32）
    walk.ts           # 六方向步进、路径、位移
    timeline.ts       # 24s 状态机与阶段边界
    scene.ts          # Three.js：粒子、丝带、雾、弦线、环绕相机
    hud.ts            # 可选：角标 / 对比文案 DOM
    export-hints.ts   # 竖屏安全区与构图 class
    main.ts           # 接线：seed、循环、交互、rAF
    style.css         # 全屏画布、HUD、安全区
  tests/
    rng.test.ts
    walk.test.ts
    timeline.test.ts
  docs/superpowers/
    specs/2026-10-28-random-walk-3d-demo-design.md
    plans/2026-10-28-random-walk-3d-demo.md   # 本文件
```

---

### Task 1: Scaffold — Vite + TypeScript + Three.js + Vitest

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`
- Create: `src/vite-env.d.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: （无，从零脚手架）
- Produces: `npm run dev` 可启动；`npm test` 可跑 Vitest；`three` 可被 `src/main.ts` import

- [ ] **Step 1: 写入 package.json**

```json
{
  "name": "math-walk-demo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: 写入 vite.config.ts**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 写入 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: 写入 index.html、src/vite-env.d.ts、src/style.css、src/main.ts、tests/smoke.test.ts**

`index.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hans">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>随机游走 3D</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app">
      <canvas id="c"></canvas>
      <div id="hud" aria-live="polite"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`src/style.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #05070f;
  color: #c8d2e0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

#c {
  display: block;
  width: 100%;
  height: 100%;
}

#hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
```

`src/main.ts`:

```ts
import './style.css';
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
if (!canvas) {
  throw new Error('#c canvas missing');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070f, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 4);

const geo = new THREE.SphereGeometry(0.05, 16, 16);
const mat = new THREE.MeshBasicMaterial({ color: 0x66e0ff });
scene.add(new THREE.Mesh(geo, mat));

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function tick(): void {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
```

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 安装依赖并跑测试**

Run: `cd /workspace/math-walk-demo && npm install && npm test`
Expected: PASS（smoke 测试通过）

- [ ] **Step 6: 确认 dev 可启动（短暂检查后停掉）**

Run: `cd /workspace/math-walk-demo && npm run build`
Expected: `tsc && vite build` 成功，无类型错误

- [ ] **Step 7: Commit**

```bash
cd /workspace/math-walk-demo
git add package.json package-lock.json vite.config.ts tsconfig.json index.html src/main.ts src/style.css src/vite-env.d.ts tests/smoke.test.ts
git commit -m "$(cat <<'EOF'
chore: scaffold Vite + TypeScript + Three.js + Vitest

EOF
)"
```

---

### Task 2: rng — 可种子 mulberry32 PRNG

**Files:**
- Create: `src/rng.ts`
- Create: `tests/rng.test.ts`
- Delete（可选后续）: `tests/smoke.test.ts`（保留亦可，不影响）

**Interfaces:**
- Consumes: （无）
- Produces:
  - `createRng(seed: number): () => number` — 返回 `[0, 1)` 均匀伪随机
  - `hashStringToSeed(input: string): number` — 把 URL 字符串 seed 转成 uint32

- [ ] **Step 1: 写失败测试**

Create `tests/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng, hashStringToSeed } from '../src/rng';

describe('createRng', () => {
  it('同一 seed 产生相同序列', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('不同 seed 产生不同序列', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });

  it('输出落在 [0, 1)', () => {
    const rng = createRng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashStringToSeed', () => {
  it('同一字符串得到同一 seed', () => {
    expect(hashStringToSeed('42')).toBe(hashStringToSeed('42'));
  });

  it('不同字符串倾向不同 seed', () => {
    expect(hashStringToSeed('42')).not.toBe(hashStringToSeed('43'));
  });

  it('纯数字字符串可解析为该数字（若在 uint32 范围）', () => {
    expect(hashStringToSeed('42')).toBe(42);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace/math-walk-demo && npm test -- tests/rng.test.ts`
Expected: FAIL（无法解析 `../src/rng` 或导出缺失）

- [ ] **Step 3: 实现 src/rng.ts**

```ts
/** mulberry32: 可种子 PRNG，返回 [0, 1) */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 将 URL 参数字符串转为 uint32 seed。
 * 若整串为十进制整数且在 [0, 2^32) 内，直接使用该值；否则做字符串哈希。
 */
export function hashStringToSeed(input: string): number {
  const asNum = Number(input);
  if (
    input.trim() !== '' &&
    Number.isInteger(asNum) &&
    asNum >= 0 &&
    asNum < 2 ** 32
  ) {
    return asNum >>> 0;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /workspace/math-walk-demo && npm test -- tests/rng.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace/math-walk-demo
git add src/rng.ts tests/rng.test.ts
git commit -m "$(cat <<'EOF'
feat: add seeded mulberry32 PRNG

EOF
)"
```

---

### Task 3: walk — 六方向步进、路径与位移

**Files:**
- Create: `src/walk.ts`
- Create: `tests/walk.test.ts`

**Interfaces:**
- Consumes: `createRng(seed: number): () => number` from `src/rng.ts`
- Produces:
  - `export type Vec3 = { x: number; y: number; z: number }`
  - `export type WalkConfig = { seed: number; steps: number; stepSize: number }`
  - `export type WalkResult = { points: Vec3[]; pathLength: number; displacement: number; seed: number }`
  - `export const DEFAULT_STEPS = 320`
  - `export const DEFAULT_STEP_SIZE = 0.08`
  - `export function generateWalk(config: WalkConfig): WalkResult`
  - 六方向：`[+1,0,0], [-1,0,0], [0,+1,0], [0,-1,0], [0,0,+1], [0,0,-1]`，等概率

- [ ] **Step 1: 写失败测试**

Create `tests/walk.test.ts`:

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace/math-walk-demo && npm test -- tests/walk.test.ts`
Expected: FAIL（无法解析 `../src/walk`）

- [ ] **Step 3: 实现 src/walk.ts**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /workspace/math-walk-demo && npm test -- tests/walk.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace/math-walk-demo
git add src/walk.ts tests/walk.test.ts
git commit -m "$(cat <<'EOF'
feat: add 6-direction axis-aligned random walk

EOF
)"
```

---

### Task 4: timeline — 24 秒状态机与阶段边界

**Files:**
- Create: `src/timeline.ts`
- Create: `tests/timeline.test.ts`

**Interfaces:**
- Consumes: （无）
- Produces:
  - `export type Phase = 'intro' | 'walk' | 'compare' | 'reset'`
  - `export const LOOP_DURATION = 24`
  - `export const PHASE_BOUNDS = { introEnd: 2, walkEnd: 18, compareEnd: 22, resetEnd: 24 } as const`
  - `export type TimelineState = { phase: Phase; localTime: number; loopTime: number; walkProgress: number; compareProgress: number; resetProgress: number }`
  - `export function phaseAt(t: number): Phase` — `t` 为单圈内秒数，归一到 `[0, 24)`
  - `export function getTimelineState(elapsedSeconds: number): TimelineState`
    - `loopTime = elapsedSeconds % 24`（对负数用正模）
    - `walkProgress`：walk 阶段内从 0→1，其它阶段按边界钳制（intro=0，compare/reset=1）
    - `compareProgress`：compare 内 0→1，之前为 0，之后为 1
    - `resetProgress`：reset 内 0→1，之前为 0

- [ ] **Step 1: 写失败测试**

Create `tests/timeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  phaseAt,
  getTimelineState,
  LOOP_DURATION,
  PHASE_BOUNDS,
} from '../src/timeline';

describe('常量', () => {
  it('循环 24 秒，边界 2 / 18 / 22 / 24', () => {
    expect(LOOP_DURATION).toBe(24);
    expect(PHASE_BOUNDS.introEnd).toBe(2);
    expect(PHASE_BOUNDS.walkEnd).toBe(18);
    expect(PHASE_BOUNDS.compareEnd).toBe(22);
    expect(PHASE_BOUNDS.resetEnd).toBe(24);
  });
});

describe('phaseAt', () => {
  it('边界分段', () => {
    expect(phaseAt(0)).toBe('intro');
    expect(phaseAt(1.9)).toBe('intro');
    expect(phaseAt(2)).toBe('walk');
    expect(phaseAt(10)).toBe('walk');
    expect(phaseAt(17.9)).toBe('walk');
    expect(phaseAt(18)).toBe('compare');
    expect(phaseAt(20)).toBe('compare');
    expect(phaseAt(22)).toBe('reset');
    expect(phaseAt(23.9)).toBe('reset');
  });

  it('对 >=24 取模', () => {
    expect(phaseAt(24)).toBe('intro');
    expect(phaseAt(26)).toBe('walk');
    expect(phaseAt(48 + 19)).toBe('compare');
  });
});

describe('getTimelineState', () => {
  it('intro 时 walkProgress=0', () => {
    const s = getTimelineState(1);
    expect(s.phase).toBe('intro');
    expect(s.walkProgress).toBe(0);
    expect(s.compareProgress).toBe(0);
    expect(s.resetProgress).toBe(0);
  });

  it('walk 中点 progress ≈ 0.5', () => {
    // walk: 2–18 → 时长 16；t=10 → (10-2)/16 = 0.5
    const s = getTimelineState(10);
    expect(s.phase).toBe('walk');
    expect(s.walkProgress).toBeCloseTo(0.5, 5);
  });

  it('compare 开始时 walkProgress=1，compareProgress=0', () => {
    const s = getTimelineState(18);
    expect(s.phase).toBe('compare');
    expect(s.walkProgress).toBe(1);
    expect(s.compareProgress).toBe(0);
  });

  it('compare 中点 compareProgress=0.5', () => {
    // compare: 18–22 → 时长 4；t=20 → 0.5
    const s = getTimelineState(20);
    expect(s.compareProgress).toBeCloseTo(0.5, 5);
  });

  it('reset 中点 resetProgress=0.5', () => {
    // reset: 22–24 → 时长 2；t=23 → 0.5
    const s = getTimelineState(23);
    expect(s.phase).toBe('reset');
    expect(s.resetProgress).toBeCloseTo(0.5, 5);
    expect(s.walkProgress).toBe(1);
    expect(s.compareProgress).toBe(1);
  });

  it('跨圈取模', () => {
    const s = getTimelineState(24 + 10);
    expect(s.loopTime).toBeCloseTo(10, 5);
    expect(s.phase).toBe('walk');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace/math-walk-demo && npm test -- tests/timeline.test.ts`
Expected: FAIL（无法解析 `../src/timeline`）

- [ ] **Step 3: 实现 src/timeline.ts**

```ts
export type Phase = 'intro' | 'walk' | 'compare' | 'reset';

export const LOOP_DURATION = 24;

export const PHASE_BOUNDS = {
  introEnd: 2,
  walkEnd: 18,
  compareEnd: 22,
  resetEnd: 24,
} as const;

export type TimelineState = {
  phase: Phase;
  localTime: number;
  loopTime: number;
  walkProgress: number;
  compareProgress: number;
  resetProgress: number;
};

function positiveMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function phaseAt(t: number): Phase {
  const loopTime = positiveMod(t, LOOP_DURATION);
  if (loopTime < PHASE_BOUNDS.introEnd) return 'intro';
  if (loopTime < PHASE_BOUNDS.walkEnd) return 'walk';
  if (loopTime < PHASE_BOUNDS.compareEnd) return 'compare';
  return 'reset';
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function getTimelineState(elapsedSeconds: number): TimelineState {
  const loopTime = positiveMod(elapsedSeconds, LOOP_DURATION);
  const phase = phaseAt(loopTime);

  const walkDur = PHASE_BOUNDS.walkEnd - PHASE_BOUNDS.introEnd; // 16
  const compareDur = PHASE_BOUNDS.compareEnd - PHASE_BOUNDS.walkEnd; // 4
  const resetDur = PHASE_BOUNDS.resetEnd - PHASE_BOUNDS.compareEnd; // 2

  let walkProgress = 0;
  if (loopTime >= PHASE_BOUNDS.walkEnd) walkProgress = 1;
  else if (loopTime > PHASE_BOUNDS.introEnd) {
    walkProgress = (loopTime - PHASE_BOUNDS.introEnd) / walkDur;
  }

  let compareProgress = 0;
  if (loopTime >= PHASE_BOUNDS.compareEnd) compareProgress = 1;
  else if (loopTime > PHASE_BOUNDS.walkEnd) {
    compareProgress = (loopTime - PHASE_BOUNDS.walkEnd) / compareDur;
  }

  let resetProgress = 0;
  if (loopTime >= PHASE_BOUNDS.compareEnd) {
    resetProgress = (loopTime - PHASE_BOUNDS.compareEnd) / resetDur;
  }

  let localTime = loopTime;
  if (phase === 'intro') localTime = loopTime;
  else if (phase === 'walk') localTime = loopTime - PHASE_BOUNDS.introEnd;
  else if (phase === 'compare') localTime = loopTime - PHASE_BOUNDS.walkEnd;
  else localTime = loopTime - PHASE_BOUNDS.compareEnd;

  return {
    phase,
    localTime,
    loopTime,
    walkProgress: clamp01(walkProgress),
    compareProgress: clamp01(compareProgress),
    resetProgress: clamp01(resetProgress),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /workspace/math-walk-demo && npm test -- tests/timeline.test.ts`
Expected: PASS

- [ ] **Step 5: 跑全量测试**

Run: `cd /workspace/math-walk-demo && npm test`
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
cd /workspace/math-walk-demo
git add src/timeline.ts tests/timeline.test.ts
git commit -m "$(cat <<'EOF'
feat: add 24s intro/walk/compare/reset timeline

EOF
)"
```

---

### Task 5: scene — Three.js 粒子、丝带、雾、弦线、环绕相机

**Files:**
- Create: `src/scene.ts`
- Modify: （本任务不改 main；仅导出可被 main 使用的 API）

**Interfaces:**
- Consumes:
  - `WalkResult`, `Vec3` from `src/walk.ts`
  - `TimelineState`, `Phase` from `src/timeline.ts`
- Produces:
  - `export type DemoScene = { renderer: THREE.WebGLRenderer; dispose: () => void; setWalk: (walk: WalkResult) => void; update: (state: TimelineState) => void }`
  - `export function createDemoScene(canvas: HTMLCanvasElement): DemoScene`
  - 行为约定：
    - 背景近黑蓝 + `scene.fog`
    - 粒子：小球/点，沿路径按 `walkProgress` 前进
    - 丝带：`THREE.Line`（BufferGeometry），顶点为已走过的 points，材质青/电蓝半透明；旧段可通过 vertex colors 降透明度
    - compare 阶段淡入起点→终点暖色细弦（`THREE.Line`）
    - 相机：慢速环绕 + 微微后拉；同一 walk.seed 可驱动可复现的初始方位（用 seed 作相位偏移）
    - reset 阶段整体 opacity / 淡出到黑（renderer clear alpha 或场景 group 透明度）
    - `setWalk` 重置几何与弦线；`update` 每帧调用
    - resize：内部监听 `window.resize` 或提供 `resize()`（实现时在 create 内绑定 window resize）

- [ ] **Step 1: 实现 src/scene.ts（完整可运行）**

因 Three.js 场景以手动验收为主，本任务无 Vitest；实现必须完整可粘贴。

```ts
import * as THREE from 'three';
import type { WalkResult, Vec3 } from './walk';
import type { TimelineState } from './timeline';

export type DemoScene = {
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
  setWalk: (walk: WalkResult) => void;
  update: (state: TimelineState) => void;
};

function toVector3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function createDemoScene(canvas: HTMLCanvasElement): DemoScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05070f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.045);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.05,
    200,
  );

  const root = new THREE.Group();
  scene.add(root);

  // 起点锚点
  const anchorMat = new THREE.MeshBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0.85,
  });
  const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), anchorMat);
  root.add(anchor);

  // 游走粒子
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0x66e0ff,
    transparent: true,
    opacity: 1,
  });
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    particleMat,
  );
  root.add(particle);

  // 轨迹丝带（Line + vertex colors）
  const maxVertices = 401; // N<=400 → points <= 401
  const trailPositions = new Float32Array(maxVertices * 3);
  const trailColors = new Float32Array(maxVertices * 4);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(trailPositions, 3),
  );
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 4));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  root.add(trail);

  // 对比弦线（起点→终点）
  const chordPositions = new Float32Array(6);
  const chordGeo = new THREE.BufferGeometry();
  chordGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(chordPositions, 3),
  );
  const chordMat = new THREE.LineBasicMaterial({
    color: 0xff9a5a,
    transparent: true,
    opacity: 0,
  });
  const chord = new THREE.Line(chordGeo, chordMat);
  root.add(chord);

  let walk: WalkResult | null = null;
  let cameraPhase = 0;

  function setWalk(next: WalkResult): void {
    walk = next;
    cameraPhase = (next.seed % 1000) / 1000 * Math.PI * 2;
    particle.position.set(0, 0, 0);
    anchor.position.set(0, 0, 0);
    trailGeo.setDrawRange(0, 0);
    chordMat.opacity = 0;
    particleMat.opacity = 1;
    trailMat.opacity = 1;
    anchorMat.opacity = 0.85;
    renderer.setClearColor(0x05070f, 1);

    const start = next.points[0]!;
    const end = next.points[next.points.length - 1]!;
    chordPositions[0] = start.x;
    chordPositions[1] = start.y;
    chordPositions[2] = start.z;
    chordPositions[3] = end.x;
    chordPositions[4] = end.y;
    chordPositions[5] = end.z;
    chordGeo.attributes.position!.needsUpdate = true;
  }

  function updateTrail(visibleCount: number): void {
    if (!walk) return;
    const n = Math.max(1, Math.min(visibleCount, walk.points.length));
    for (let i = 0; i < n; i++) {
      const p = walk.points[i]!;
      trailPositions[i * 3] = p.x;
      trailPositions[i * 3 + 1] = p.y;
      trailPositions[i * 3 + 2] = p.z;
      // 越旧越淡：i=0 最淡，i=n-1 最亮
      const age = n <= 1 ? 1 : i / (n - 1);
      const a = 0.15 + 0.85 * age;
      trailColors[i * 4] = 0.4;
      trailColors[i * 4 + 1] = 0.88;
      trailColors[i * 4 + 2] = 1.0;
      trailColors[i * 4 + 3] = a;
    }
    trailGeo.attributes.position!.needsUpdate = true;
    trailGeo.attributes.color!.needsUpdate = true;
    trailGeo.setDrawRange(0, n);
  }

  function updateCamera(state: TimelineState): void {
    const orbit = cameraPhase + state.loopTime * 0.12;
    const baseR = 3.2;
    const pull = state.walkProgress * 0.9 + state.compareProgress * 0.3;
    const r = baseR + pull;
    const y = 0.55 + state.walkProgress * 0.35;
    camera.position.set(
      Math.cos(orbit) * r,
      y,
      Math.sin(orbit) * r,
    );
    camera.lookAt(0, 0, 0);
  }

  function update(state: TimelineState): void {
    if (!walk) return;

    const idxFloat = state.walkProgress * (walk.points.length - 1);
    const i0 = Math.floor(idxFloat);
    const i1 = Math.min(walk.points.length - 1, i0 + 1);
    const frac = idxFloat - i0;
    const a = walk.points[i0]!;
    const b = walk.points[i1]!;
    particle.position.set(
      a.x + (b.x - a.x) * frac,
      a.y + (b.y - a.y) * frac,
      a.z + (b.z - a.z) * frac,
    );

    updateTrail(i1 + 1);
    updateCamera(state);

    // compare：暖色弦淡入
    if (state.phase === 'compare' || state.phase === 'reset') {
      chordMat.opacity = Math.min(1, state.compareProgress * 1.2) * 0.95;
    } else {
      chordMat.opacity = 0;
    }

    // reset：淡出到黑
    if (state.phase === 'reset') {
      const fade = 1 - state.resetProgress;
      particleMat.opacity = fade;
      trailMat.opacity = fade;
      anchorMat.opacity = 0.85 * fade;
      chordMat.opacity *= fade;
      const c = 0x05070f;
      renderer.setClearColor(c, 1);
      // 通过雾密度略增强化淡出
      (scene.fog as THREE.FogExp2).density = 0.045 + state.resetProgress * 0.25;
    } else {
      particleMat.opacity = 1;
      trailMat.opacity = 1;
      anchorMat.opacity = 0.85;
      (scene.fog as THREE.FogExp2).density = 0.045;
    }

    // intro：粒子在原点高亮，轨迹为空
    if (state.phase === 'intro') {
      particle.position.set(0, 0, 0);
      updateTrail(1);
    }

    renderer.render(scene, camera);
  }

  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  function dispose(): void {
    window.removeEventListener('resize', onResize);
    trailGeo.dispose();
    trailMat.dispose();
    chordGeo.dispose();
    chordMat.dispose();
    particle.geometry.dispose();
    particleMat.dispose();
    anchor.geometry.dispose();
    anchorMat.dispose();
    renderer.dispose();
  }

  return { renderer, dispose, setWalk, update };
}

// 保留 Vec3 转向量工具供调试（避免 unused 可删）
void toVector3;
```

- [ ] **Step 2: 临时接线验证（随后 Task 6 会正式替换 main）**

将 `src/main.ts` 暂改为最小驱动，确认能编译：

```ts
import './style.css';
import { createDemoScene } from './scene';
import { generateWalk, DEFAULT_STEPS, DEFAULT_STEP_SIZE } from './walk';
import { getTimelineState } from './timeline';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
if (!canvas) throw new Error('#c missing');

const demo = createDemoScene(canvas);
const walk = generateWalk({
  seed: 42,
  steps: DEFAULT_STEPS,
  stepSize: DEFAULT_STEP_SIZE,
});
demo.setWalk(walk);

const t0 = performance.now();
function tick(now: number): void {
  const elapsed = (now - t0) / 1000;
  demo.update(getTimelineState(elapsed));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 3: 构建检查**

Run: `cd /workspace/math-walk-demo && npm run build`
Expected: 成功

- [ ] **Step 4: 手动浏览器验收（写清步骤）**

Run: `cd /workspace/math-walk-demo && npm run dev`

在浏览器打开终端给出的本地 URL，确认：
1. 深色近黑蓝背景 + 轻微雾感
2. 原点有亮点粒子；2s 后开始沿折线移动
3. 青色半透明轨迹随走生长，旧段更淡
4. 镜头缓慢环绕并略后拉
5. 约 18s 出现暖色起点→终点弦线
6. 约 22–24s 画面淡出变暗，随后因尚未换 seed 会用同一 walk 再播（换 seed 在 Task 6）

- [ ] **Step 5: Commit**

```bash
cd /workspace/math-walk-demo
git add src/scene.ts src/main.ts
git commit -m "$(cat <<'EOF'
feat: add Three.js walk scene with trail, chord, orbit camera

EOF
)"
```

---

### Task 6: 接线 main + HUD + export-hints + URL seed + 交互循环

**Files:**
- Create: `src/hud.ts`
- Create: `src/export-hints.ts`
- Modify: `src/main.ts`（完整正式版）
- Modify: `src/style.css`（安全区与 HUD 样式）

**Interfaces:**
- Consumes: `createRng`/`hashStringToSeed`, `generateWalk`/`DEFAULT_*`, `getTimelineState`/`LOOP_DURATION`/`Phase`, `createDemoScene`
- Produces:
  - `applyExportHints(root: HTMLElement): void` — 给 `#app` 加竖屏安全区 class；宽高比接近 9:16 时加 `portrait`，否则 `landscape`
  - `createHud(el: HTMLElement): { setPhase(phase: Phase, stats?: { pathLength: number; displacement: number; seed: number }): void }`
  - `main.ts` 行为：
    - 读 `URLSearchParams` 的 `seed`；有则锁定该 seed，自动循环仍用同一 seed（复录）；无则每圈 `Date.now()` 或随机新 seed
    - 点击画布或空格 → 新 seed 重跑（若 URL 锁定，同时 `history.replaceState` 更新 `?seed=`）
    - 自动：每圈结束（检测到 loop 回绕）若未锁定则换新 seed
    - HUD：intro 显示「随机游走」；compare 显示路径长度与位移文案；reset 淡出

- [ ] **Step 1: 实现 src/export-hints.ts**

```ts
/** 竖/横构图 class 与安全区标记（文案落在上下安全区由 CSS 控制） */
export function applyExportHints(root: HTMLElement): void {
  const apply = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = w / h;
    const portrait = ratio <= 0.75; // ~9:16 = 0.5625；放宽到 0.75
    root.classList.toggle('portrait', portrait);
    root.classList.toggle('landscape', !portrait);
    root.classList.add('export-safe');
    root.style.setProperty('--safe-top', 'max(4.5vh, env(safe-area-inset-top, 0px))');
    root.style.setProperty(
      '--safe-bottom',
      'max(4.5vh, env(safe-area-inset-bottom, 0px))',
    );
  };
  apply();
  window.addEventListener('resize', apply);
}
```

- [ ] **Step 2: 实现 src/hud.ts**

```ts
import type { Phase } from './timeline';

export type HudStats = {
  pathLength: number;
  displacement: number;
  seed: number;
};

export type Hud = {
  setPhase: (phase: Phase, stats?: HudStats) => void;
};

export function createHud(el: HTMLElement): Hud {
  el.innerHTML = `
    <div class="hud-top">
      <div class="hud-title" data-role="title"></div>
      <div class="hud-seed" data-role="seed"></div>
    </div>
    <div class="hud-bottom">
      <div class="hud-compare" data-role="compare"></div>
    </div>
  `;
  const title = el.querySelector<HTMLElement>('[data-role="title"]')!;
  const seedEl = el.querySelector<HTMLElement>('[data-role="seed"]')!;
  const compare = el.querySelector<HTMLElement>('[data-role="compare"]')!;

  function setPhase(phase: Phase, stats?: HudStats): void {
    if (stats) {
      seedEl.textContent = `seed ${stats.seed}`;
    }

    if (phase === 'intro') {
      title.textContent = '随机游走';
      title.style.opacity = '1';
      compare.style.opacity = '0';
      compare.textContent = '';
    } else if (phase === 'walk') {
      title.style.opacity = '0.35';
      compare.style.opacity = '0';
    } else if (phase === 'compare' && stats) {
      title.style.opacity = '0.2';
      compare.style.opacity = '1';
      const path = stats.pathLength.toFixed(2);
      const disp = stats.displacement.toFixed(2);
      compare.innerHTML = `
        <div>路径长度 ≈ ${path}</div>
        <div>直线位移 ≈ ${disp}</div>
        <div class="hud-note">位移 ≪ 路径</div>
      `;
    } else if (phase === 'reset') {
      title.style.opacity = '0';
      compare.style.opacity = '0';
    }
  }

  return { setPhase };
}
```

- [ ] **Step 3: 更新 src/style.css（完整文件）**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #05070f;
  color: #c8d2e0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC',
    'Noto Sans SC', sans-serif;
}

#app {
  position: relative;
}

#c {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
}

#hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.export-safe .hud-top {
  position: absolute;
  top: var(--safe-top, 4.5vh);
  left: 5vw;
  right: 5vw;
  text-align: center;
}

.export-safe .hud-bottom {
  position: absolute;
  bottom: var(--safe-bottom, 4.5vh);
  left: 5vw;
  right: 5vw;
  text-align: center;
}

.hud-title {
  font-size: clamp(14px, 3.6vw, 22px);
  letter-spacing: 0.35em;
  font-weight: 500;
  color: rgba(200, 210, 224, 0.72);
  transition: opacity 0.4s ease;
}

.hud-seed {
  margin-top: 0.4rem;
  font-size: clamp(10px, 2.4vw, 13px);
  color: rgba(160, 176, 196, 0.45);
  letter-spacing: 0.08em;
}

.hud-compare {
  font-size: clamp(12px, 3.2vw, 18px);
  line-height: 1.55;
  color: rgba(220, 200, 170, 0.82);
  transition: opacity 0.5s ease;
}

.hud-compare .hud-note {
  margin-top: 0.35rem;
  font-size: 0.92em;
  color: rgba(255, 154, 90, 0.85);
}

/* 竖屏默认强调上下安全；横屏略收左右边距即可 */
.portrait .hud-title {
  letter-spacing: 0.42em;
}
```

- [ ] **Step 4: 实现正式 src/main.ts**

```ts
import './style.css';
import { hashStringToSeed } from './rng';
import {
  generateWalk,
  DEFAULT_STEPS,
  DEFAULT_STEP_SIZE,
  type WalkResult,
} from './walk';
import { getTimelineState, LOOP_DURATION, type Phase } from './timeline';
import { createDemoScene } from './scene';
import { createHud } from './hud';
import { applyExportHints } from './export-hints';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
const hudRoot = document.querySelector<HTMLElement>('#hud');
const appRoot = document.querySelector<HTMLElement>('#app');
if (!canvas || !hudRoot || !appRoot) {
  throw new Error('missing #c, #hud, or #app');
}

applyExportHints(appRoot);
const hud = createHud(hudRoot);
const demo = createDemoScene(canvas);

function readSeedFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || raw === '') return null;
  return hashStringToSeed(raw);
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function writeSeedToUrl(seed: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
}

let lockedSeed = readSeedFromUrl();
let currentSeed = lockedSeed ?? randomSeed();
let walk: WalkResult = generateWalk({
  seed: currentSeed,
  steps: DEFAULT_STEPS,
  stepSize: DEFAULT_STEP_SIZE,
});
demo.setWalk(walk);
hud.setPhase('intro', {
  pathLength: walk.pathLength,
  displacement: walk.displacement,
  seed: walk.seed,
});

let epoch = performance.now();
let lastPhase: Phase | null = null;
let lastLoopIndex = 0;

function restart(seed: number, updateUrl: boolean): void {
  currentSeed = seed;
  if (updateUrl) {
    lockedSeed = seed;
    writeSeedToUrl(seed);
  }
  walk = generateWalk({
    seed: currentSeed,
    steps: DEFAULT_STEPS,
    stepSize: DEFAULT_STEP_SIZE,
  });
  demo.setWalk(walk);
  epoch = performance.now();
  lastPhase = null;
  lastLoopIndex = 0;
  hud.setPhase('intro', {
    pathLength: walk.pathLength,
    displacement: walk.displacement,
    seed: walk.seed,
  });
}

function onRerun(): void {
  const next = randomSeed();
  restart(next, true);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    onRerun();
  }
});
canvas.addEventListener('click', () => onRerun());

function tick(now: number): void {
  const elapsed = (now - epoch) / 1000;
  const loopIndex = Math.floor(elapsed / LOOP_DURATION);
  if (loopIndex > lastLoopIndex) {
    lastLoopIndex = loopIndex;
    // 自动循环：未锁定则每圈新 seed；锁定则同 seed 复播
    if (lockedSeed === null) {
      currentSeed = randomSeed();
      walk = generateWalk({
        seed: currentSeed,
        steps: DEFAULT_STEPS,
        stepSize: DEFAULT_STEP_SIZE,
      });
      demo.setWalk(walk);
    } else {
      // 同 seed 重播：重置几何
      demo.setWalk(walk);
    }
  }

  const state = getTimelineState(elapsed);
  demo.update(state);

  if (state.phase !== lastPhase) {
    lastPhase = state.phase;
    hud.setPhase(state.phase, {
      pathLength: walk.pathLength,
      displacement: walk.displacement,
      seed: walk.seed,
    });
  } else if (state.phase === 'compare') {
    hud.setPhase('compare', {
      pathLength: walk.pathLength,
      displacement: walk.displacement,
      seed: walk.seed,
    });
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// 若进入时 URL 已有 seed，保持锁定显示
if (lockedSeed !== null) {
  writeSeedToUrl(lockedSeed);
}
```

- [ ] **Step 5: 构建 + 全量测试**

Run: `cd /workspace/math-walk-demo && npm test && npm run build`
Expected: 测试全 PASS；build 成功

- [ ] **Step 6: 手动浏览器验收**

Run: `cd /workspace/math-walk-demo && npm run dev`

验收：
1. 打开无参数 URL → 自动播放；角标「随机游走」；约 24s 后换新 seed 继续
2. 打开 `?seed=42` → 两次刷新轨迹一致；自动循环仍为 seed 42
3. 点击或空格 → URL seed 更新、立即重跑、轨迹明显不同
4. 竖屏窗口：文案在上下安全区；横屏：仍可读
5. compare 阶段底部出现路径长度与位移，且位移明显小于路径

- [ ] **Step 7: Commit**

```bash
cd /workspace/math-walk-demo
git add src/main.ts src/hud.ts src/export-hints.ts src/style.css
git commit -m "$(cat <<'EOF'
feat: wire main loop, HUD, export hints, seed URL and rerun

EOF
)"
```

---

### Task 7: README 启动说明 + 对照 spec 验收清单

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 已实现的 npm scripts 与 URL/交互行为
- Produces: 可独立按 README 启动并完成验收的说明文档

- [ ] **Step 1: 写 README.md**

```md
# 随机游走 3D 演示

面向自媒体的三维轴对齐随机游走可视化：自动 24 秒循环，竖屏可直接系统录屏。

## 技术栈

Vite + TypeScript + Three.js + Vitest

## 启动

\`\`\`bash
npm install
npm run dev
\`\`\`

浏览器打开终端提示的本地地址。

\`\`\`bash
npm test      # 纯逻辑单测
npm run build # 静态产物到 dist/
npm run preview
\`\`\`

## 使用

- 打开即自动播放（intro → walk → compare → reset，共 24 秒循环）
- `?seed=42` 锁定种子，方便复录同一条
- 点击画面或按空格：换种子重跑（并写入 URL）
- 默认竖屏 9:16 构图；桌面可拉横窗预览

## 默认参数

| 项 | 值 |
|----|----|
| 循环 | 24s |
| 步数 N | 320 |
| 步长 | 0.08 |
| 方向 | ±x ±y ±z 等概率 |

## 第一版验收清单

- [ ] 打开后自动播放，单圈约 15–30 秒（锚定 24s）并循环
- [ ] 竖屏构图可直接系统录屏；文案在上下安全区
- [ ] 可见轨迹生长；18–22s 显示路径长度 vs 直线位移对比与暖色弦
- [ ] 同一 seed 两次运行轨迹一致；换 seed 明显不同
- [ ] 点击或空格可重跑
- [ ] `npm test` 通过；`npm run build` 成功

## 非目标（第一版不做）

多粒子扩散云、障碍/得分、后端与登录、MediaRecorder 内录、音效、公式墙。
```

- [ ] **Step 2: 对照 spec 快速自检（实现者勾选）**

对照 `docs/superpowers/specs/2026-10-28-random-walk-3d-demo-design.md`：
- §1 目标与成功标准 → Task 5–7
- §3 时间轴 → Task 4 + 6
- §4 数学规则 → Task 2–3
- §5 画面规范 → Task 5–6
- §6 技术架构 → Task 1 + 文件结构
- §8 验收清单 → README + Task 6 手动步骤

- [ ] **Step 3: Commit**

```bash
cd /workspace/math-walk-demo
git add README.md
git commit -m "$(cat <<'EOF'
docs: add README with start guide and acceptance checklist

EOF
)"
```

---

## Self-Review（写计划时已执行）

### 1. Spec coverage

| Spec 节 | 覆盖任务 |
|---------|----------|
| §1 目标 / 24s 自动循环 / 竖屏 / seed | Task 4, 5, 6, 7 |
| §1 非目标 | Global Constraints + README |
| §2 受众与三种导出 | export-hints + README（同一套演示） |
| §3 时间轴 0–2 / 2–18 / 18–22 / 22–24 | Task 4, 6 |
| §3 点击/空格重跑 | Task 6 |
| §4 六方向、N、步长、路径/位移、PRNG、?seed= | Task 2, 3, 6；默认 N=320、step=0.08 |
| §5 背景雾、粒子、丝带衰减、暖色弦、文案安全区 | Task 5, 6 |
| §6 Vite/TS/Three、模块划分、目录 | Task 1 + File Structure |
| §7 手机性能可降级 | 未单列任务：N/轨迹缓冲已按 max 401 固定；降级可后续改 DEFAULT_STEPS（YAGNI，第一版可配常量即可） |
| §8 验收清单 | Task 6 手动步骤 + Task 7 README |

缺口处理：§7「可降级」仅作常量可改，不单独开任务（符合 YAGNI / 第一版范围）。无未覆盖的硬性成功标准。

### 2. Placeholder scan

已避免 TBD/TODO/「类似 Task N」/空泛「加测试」；每个编码 step 含完整代码与明确命令。

### 3. Type consistency

- `createRng` / `hashStringToSeed`：Task 2 定义，Task 3/6 使用一致
- `generateWalk` / `WalkResult` / `Vec3` / `DEFAULT_STEPS` / `DEFAULT_STEP_SIZE`：Task 3 → 5/6
- `Phase` / `getTimelineState` / `LOOP_DURATION` / `TimelineState`：Task 4 → 5/6
- `createDemoScene` / `setWalk` / `update`：Task 5 → 6
- `createHud` / `applyExportHints`：Task 6 内自洽
