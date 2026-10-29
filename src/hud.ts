import type { Phase } from './timeline';
import { SLOW_MO_FACTOR } from './timeline';
import {
  COLORS,
  pendulumPeriod,
  type SmashSimulation,
  type SmashResult,
} from './pendulum';

export type HudStats = {
  seed: number;
  sim: SmashSimulation;
  raceSeconds?: number;
};

export type Hud = {
  setPhase: (phase: Phase, stats?: HudStats) => void;
};

const TITLE = '三个单摆，谁先砸碎花瓶？';
const TAGLINE = '周期看长度，阻尼让热闹收场';
const NAMES = ['青摆', '琥珀摆', '粉摆'] as const;

function dot(index: number): string {
  return `<span class="hud-dot" style="background:${COLORS[index] ?? '#fff'}"></span>`;
}

function name(index: number): string {
  return NAMES[index] ?? `摆 ${index + 1}`;
}

function fmt(t: number): string {
  return t.toFixed(2);
}

function sortResults(sim: SmashSimulation): SmashResult[] {
  return [...sim.results].sort((a, b) => {
    if (a.hitTime === null && b.hitTime === null) return a.index - b.index;
    if (a.hitTime === null) return 1;
    if (b.hitTime === null) return -1;
    return a.hitTime - b.hitTime;
  });
}

export function createHud(el: HTMLElement): Hud {
  el.innerHTML = `
    <div class="hud-top">
      <div class="hud-title" data-role="title">${TITLE}</div>
      <div class="hud-tagline" data-role="tagline">${TAGLINE}</div>
      <div class="hud-seed" data-role="seed"></div>
    </div>
    <div class="hud-bottom">
      <div class="hud-clock" data-role="clock"></div>
      <div class="hud-status" data-role="status"></div>
      <div class="hud-result" data-role="result"></div>
    </div>
  `;
  const title = el.querySelector<HTMLElement>('[data-role="title"]')!;
  const tagline = el.querySelector<HTMLElement>('[data-role="tagline"]')!;
  const seedEl = el.querySelector<HTMLElement>('[data-role="seed"]')!;
  const clock = el.querySelector<HTMLElement>('[data-role="clock"]')!;
  const status = el.querySelector<HTMLElement>('[data-role="status"]')!;
  const result = el.querySelector<HTMLElement>('[data-role="result"]')!;

  let current: HudStats | null = null;
  let lastStatus = '';
  let lastResult = '';

  function setPhase(phase: Phase, stats?: HudStats): void {
    if (stats) {
      current = stats;
      seedEl.textContent = `seed ${stats.seed}`;
    }

    if (phase === 'intro') {
      title.style.opacity = '1';
      tagline.style.opacity = '0.75';
      seedEl.style.opacity = '0.55';
      clock.style.opacity = '0';
      status.style.opacity = '0';
      result.style.opacity = '0';
      clock.innerHTML = '';
      status.innerHTML = '';
      result.innerHTML = '';
      lastStatus = '';
      lastResult = '';
      return;
    }

    if (phase === 'race') {
      title.style.opacity = '0.28';
      tagline.style.opacity = '0';
      seedEl.style.opacity = '0.35';
      clock.style.opacity = '1';
      status.style.opacity = '1';
      result.style.opacity = '0';
      if (lastResult !== '') {
        result.innerHTML = '';
        lastResult = '';
      }
      if (!current) return;

      const elapsed = current.raceSeconds ?? 0;
      clock.innerHTML = `⏱ ${elapsed.toFixed(2)}s<span class="hud-slow">${SLOW_MO_FACTOR.toFixed(
        1,
      )}× 慢放</span>`;

      const chips = current.sim.results
        .map((r) => {
          const hit = r.hitTime !== null && r.hitTime <= elapsed;
          if (!hit) {
            const period = pendulumPeriod(r.length);
            return `<span class="hud-chip">${dot(r.index)}${name(
              r.index,
            )} <span class="hud-chip-meta">${r.length.toFixed(
              1,
            )}m · T≈${period.toFixed(1)}s</span></span>`;
          }
          const winner = r.index === current!.sim.winnerIndex;
          return `<span class="hud-chip is-hit${
            winner ? ' is-winner' : ''
          }">${dot(r.index)}${name(r.index)} <span class="hud-chip-meta">${fmt(
            r.hitTime!,
          )}s ${winner ? '砸中' : '到位'}</span></span>`;
        })
        .join('');
      if (chips !== lastStatus) {
        status.innerHTML = chips;
        lastStatus = chips;
      }
      return;
    }

    if (phase === 'result') {
      title.style.opacity = '0.12';
      tagline.style.opacity = '0';
      seedEl.style.opacity = '0.2';
      clock.style.opacity = '0';
      status.style.opacity = '0';
      result.style.opacity = '1';
      if (!current) return;

      const sorted = sortResults(current.sim);
      const best = sorted.find((r) => r.hitTime !== null)?.hitTime ?? null;
      const lines = sorted
        .map((r) => {
          const winner = r.index === current!.sim.winnerIndex;
          let text: string;
          if (r.hitTime === null) {
            text = '没够着';
          } else if (winner) {
            text = `${fmt(r.hitTime)}s · 砸中`;
          } else if (best !== null) {
            text = `${fmt(r.hitTime)}s · 慢 ${fmt(r.hitTime - best)}s`;
          } else {
            text = `${fmt(r.hitTime)}s`;
          }
          return `<div class="hud-ball-line${winner ? ' is-winner' : ''}">
            ${dot(r.index)}
            <span class="hud-ball-name">${name(r.index)}</span>
            <span class="hud-ball-len">${r.length.toFixed(1)}m</span>
            <span class="hud-ball-time">${text}</span>
          </div>`;
        })
        .join('');
      const html = `${lines}<div class="hud-note">${TAGLINE}</div>`;
      if (html !== lastResult) {
        result.innerHTML = html;
        lastResult = html;
      }
      return;
    }

    // reset
    title.style.opacity = '0';
    tagline.style.opacity = '0';
    seedEl.style.opacity = '0';
    clock.style.opacity = '0';
    status.style.opacity = '0';
    result.style.opacity = '0';
  }

  return { setPhase };
}
