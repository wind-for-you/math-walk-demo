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
