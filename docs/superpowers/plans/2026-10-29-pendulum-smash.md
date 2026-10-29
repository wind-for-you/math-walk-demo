# Pendulum Smash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the who-hits-wall race with a 3-pendulum “smash the vase” demo: damped pendulums, different lengths, first hit wins; ~28s auto-loop for vertical short video.

**Architecture:** Pure `pendulum.ts` integrates θ with damping and detects vase hits. Timeline keeps intro→race→result→reset. Scene draws 3 ropes/bobs + vase. HUD uses Chinese hook title. Main wires seed URL + click/space. Deploy via existing Pages workflow.

**Tech Stack:** Vite + TypeScript + Three.js + Vitest; GitHub Pages Actions.

## Global Constraints

- Title: 《三个单摆，谁先砸碎花瓶？》
- Light damping; lengths fixed constants; LOOP ~28s
- Same repo wind-for-you/math-walk-demo; Chinese HUD
- `npm test` and `npm run build` must pass

## File map

- Create: `src/pendulum.ts`, `tests/pendulum.test.ts`
- Modify: `src/timeline.ts` (keep phase names if compatible), `src/scene.ts`, `src/hud.ts`, `src/main.ts`, `src/style.css`, `index.html`, `README.md`
- May leave race/walk unused or remove from main only (YAGNI: don’t delete race module unless it breaks build)

---

### Task 1: pendulum physics + smash detection

**Files:** Create `src/pendulum.ts`, `tests/pendulum.test.ts`

**Produces:**
- `G = 9.8`, `GAMMA` damping, `THETA0`, `VASE` position, `PENDULUM_LENGTHS: [number,number,number]`, `COLORS`
- `type PendulumState = { theta: number; omega: number; L: number }`
- `stepPendulum(s, dt): PendulumState` using `\ddotθ = -(g/L)sinθ - γ ω`
- `bobPosition(pivot, L, theta): {x,y}` (2D in x-y; z=0 in scene)
- `type SmashResult = { index; hitTime: number | null; length: number }`
- `simulateSmash(durationSeconds, dt): { winnerIndex; results: SmashResult[]; samples }` — integrate until duration; hit when distance(bob, vase) ≤ HIT_RADIUS; record first hit time per pendulum

- [ ] Failing tests: same initial → shorter L hits earlier (or at least different hit times); damping reduces |theta| over time; simulateSmash deterministic
- [ ] Implement; `npm test -- tests/pendulum.test.ts` PASS
- [ ] Commit `feat: damped pendulum smash simulation`

Tune vase position and lengths so at least one hits within ~20s race window.

---

### Task 2: timeline (28s intro/race/result/reset)

Reuse existing phase names from race version if already `intro|race|result|reset`; else align. LOOP_DURATION=28.

- [ ] Tests updated; commit `feat: timeline tuned for pendulum smash`

---

### Task 3: scene

Replace race shell with:
- 3 pivots along x
- ropes (Line) + bob spheres
- vase mesh (bright)
- update from precomputed samples or live step using raceProgress
- freeze winner on hit; flash

- [ ] Commit `feat: pendulum smash Three.js scene`

---

### Task 4: HUD + main + README

- Title《三个单摆，谁先砸碎花瓶？》
- Result lines +「周期看长度，阻尼让热闹收场」
- Optional faint T≈2π√(L/g) during race
- Wire simulateSmash; seed optional for future; click/space rerun (can reshuffle length order via seed later — v1 fixed lengths OK)
- index.html title; README acceptance

- [ ] `npm test` + `npm run build` PASS
- [ ] Commit `feat: wire pendulum smash demo`

---

### Task 5: deploy

Push to feat, merge main, Pages success, verify title on live site.

