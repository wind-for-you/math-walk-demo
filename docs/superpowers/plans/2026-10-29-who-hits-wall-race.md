# Who Hits Wall Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-walk “path vs displacement” demo with a 3-ball race: who first reaches sphere radius R, auto-loop ~28s for vertical short video, same seed URL + click/space rerun.

**Architecture:** Keep `rng`/`walk`. Add pure `race.ts` that runs 3 walks from derived seeds and records first hit step/time. Change timeline phases to intro → race → result → reset. Update scene (shell + 3 trails + freeze flash) and HUD. Wire `main.ts`. Deploy via existing Pages workflow on push to main.

**Tech Stack:** Vite + TypeScript + Three.js + Vitest; GitHub Pages Actions already in repo.

## Global Constraints

- Loop ~24–30s (anchor LOOP_DURATION = 28).
- Ball count = 3, R and step size as constants (no UI knobs).
- Chinese HUD copy; vertical 9:16.
- Same repo `wind-for-you/math-walk-demo`; push feature then merge/deploy main.
- Code changes via Claude Code on box when implementing; bot verifies, pushes, deploys.

## File map

- Create: `src/race.ts`, `tests/race.test.ts`
- Modify: `src/timeline.ts`, `tests/timeline.test.ts`, `src/scene.ts`, `src/hud.ts`, `src/main.ts`, `src/style.css`, `index.html` (title), `README.md`
- Keep: `src/rng.ts`, `src/walk.ts`, `src/export-hints.ts`, `.github/workflows/*`

---

### Task 1: race module (pure logic)

**Files:**
- Create: `src/race.ts`
- Test: `tests/race.test.ts`
- Consumes: `generateWalk`, `WalkResult`, `Vec3`, `DEFAULT_STEPS`, `DEFAULT_STEP_SIZE` from `walk.ts`
- Produces: `RACE_BALL_COUNT`, `SHELL_RADIUS`, `BALL_COLORS`, `RaceBallResult`, `RaceResult`, `simulateRace(seed)`, `hitTimeSeconds(hitStep, raceDurationSeconds)`

- [ ] **Step 1: Write failing tests** in `tests/race.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulateRace, SHELL_RADIUS, RACE_BALL_COUNT } from '../src/race';

describe('simulateRace', () => {
  it('returns three balls with stable order for same seed', () => {
    const a = simulateRace(42);
    const b = simulateRace(42);
    expect(a.balls).toHaveLength(RACE_BALL_COUNT);
    expect(a.balls.map((x) => x.hitStep)).toEqual(b.balls.map((x) => x.hitStep));
    expect(a.winnerIndex).toBe(b.winnerIndex);
  });

  it('marks hit when radius crossed', () => {
    const r = simulateRace(7);
    for (const ball of r.balls) {
      if (ball.hitStep !== null) {
        const p = ball.walk.points[ball.hitStep]!;
        expect(p.x * p.x + p.y * p.y + p.z * p.z).toBeGreaterThanOrEqual(
          SHELL_RADIUS * SHELL_RADIUS,
        );
      }
    }
  });

  it('seed 1 has at least one hitter within steps', () => {
    // If this fails, lower SHELL_RADIUS in race.ts constants
    const r = simulateRace(1);
    expect(r.balls.some((b) => b.hitStep !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/race.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `src/race.ts`:

```ts
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
```

Tune `SHELL_RADIUS` so tests pass (try 1.0–1.6 if seed 1 never hits).

- [ ] **Step 4: `npm test -- tests/race.test.ts`** — PASS.

- [ ] **Step 5: Commit** `feat: add race simulation for who-hits-wall`

---

### Task 2: timeline phases

**Files:** Modify `src/timeline.ts`, `tests/timeline.test.ts`

- Phases: `'intro' | 'race' | 'result' | 'reset'`
- LOOP_DURATION = 28; bounds: introEnd 2, raceEnd 22, resultEnd 26, resetEnd 28
- Rename walkProgress → raceProgress; compareProgress → resultProgress
- Update all timeline tests accordingly

- [ ] Write failing tests for new phase names/bounds
- [ ] Implement
- [ ] `npm test -- tests/timeline.test.ts` PASS
- [ ] Commit `feat: timeline for race/result loop`

---

### Task 3: scene — shell + 3 trails

**Files:** Modify `src/scene.ts`

- Replace single walk with `setRace(race: RaceResult)`
- Draw translucent SphereGeometry shell radius SHELL_RADIUS
- Three colored line trails + small sphere meshes
- On update(state): advance each trail by raceProgress, freeze trail/ball at hitStep when crossed; flash winner (emissive pulse) when result phase
- Camera: slow orbit framing the shell

- [ ] Implement scene changes (manual visual check after Task 5)
- [ ] Commit `feat: 3-ball race scene with shell`

---

### Task 4: HUD

**Files:** Modify `src/hud.ts`, `src/style.css`

- Title intro:「谁先撞墙？」
- During race: show elapsed race seconds (optional bottom clock)
- Result: three lines color +「Xs 撞墙」or「还在里面」; note「随机里，迟早有人先撞上」
- HudStats becomes `{ seed, race: RaceResult, raceSeconds?: number }`

- [ ] Implement
- [ ] Commit `feat: HUD for race results`

---

### Task 5: main wiring + README

**Files:** Modify `src/main.ts`, `index.html`, `README.md`

- Use `simulateRace` instead of `generateWalk`
- Pass race into scene/hud; keep seed URL + click/space
- Title「随机游走 · 谁先撞墙」
- README: new gameplay, acceptance checklist from spec

- [ ] `npm test` all PASS; `npm run build` PASS
- [ ] Commit `feat: wire who-hits-wall race demo`

---

### Task 6: verify locally + deploy

- [ ] `npm test && npm run build`
- [ ] Preview briefly if possible
- [ ] Push branch; merge/fast-forward to `main` (or PR) on `wind-for-you/math-walk-demo`
- [ ] Ensure Pages workflow succeeds; curl site 200
- [ ] Report Pages URL to user

