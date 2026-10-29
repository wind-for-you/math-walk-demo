import './style.css';
import { hashStringToSeed } from './rng';
import { simulateRace, type RaceResult } from './race';
import { getTimelineState, LOOP_DURATION } from './timeline';
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
let race: RaceResult = simulateRace(currentSeed);
demo.setRace(race);
hud.setPhase('intro', { seed: race.seed, race });

let epoch = performance.now();
let lastLoopIndex = 0;

function restart(seed: number, updateUrl: boolean): void {
  currentSeed = seed;
  if (updateUrl) {
    lockedSeed = seed;
    writeSeedToUrl(seed);
  }
  race = simulateRace(currentSeed);
  demo.setRace(race);
  epoch = performance.now();
  lastLoopIndex = 0;
  hud.setPhase('intro', { seed: race.seed, race });
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
      race = simulateRace(currentSeed);
    }
    demo.setRace(race);
  }

  const state = getTimelineState(elapsed);
  demo.update(state);
  hud.setPhase(state.phase, {
    seed: race.seed,
    race,
    raceSeconds: state.phase === 'race' ? state.localTime : undefined,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// 若进入时 URL 已有 seed，保持锁定显示
if (lockedSeed !== null) {
  writeSeedToUrl(lockedSeed);
}
