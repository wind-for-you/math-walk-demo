import type { Phase } from './timeline';
import { RACE_DURATION_SECONDS } from './timeline';
import {
  BALL_COLORS,
  hitTimeSeconds,
  type RaceResult,
  type RaceBallResult,
} from './race';
import { DEFAULT_STEPS } from './walk';

export type HudStats = {
  seed: number;
  race: RaceResult;
  raceSeconds?: number;
};

export type Hud = {
  setPhase: (phase: Phase, stats?: HudStats) => void;
};

function ballLabel(ball: RaceBallResult): string {
  return `球 ${ball.index + 1}`;
}

function dot(index: number): string {
  return `<span class="hud-dot" style="background:${BALL_COLORS[index] ?? '#fff'}"></span>`;
}

export function createHud(el: HTMLElement): Hud {
  el.innerHTML = `
    <div class="hud-top">
      <div class="hud-title" data-role="title"></div>
      <div class="hud-seed" data-role="seed"></div>
    </div>
    <div class="hud-bottom">
      <div class="hud-clock" data-role="clock"></div>
      <div class="hud-status" data-role="status"></div>
      <div class="hud-result" data-role="result"></div>
    </div>
  `;
  const title = el.querySelector<HTMLElement>('[data-role="title"]')!;
  const seedEl = el.querySelector<HTMLElement>('[data-role="seed"]')!;
  const clock = el.querySelector<HTMLElement>('[data-role="clock"]')!;
  const status = el.querySelector<HTMLElement>('[data-role="status"]')!;
  const result = el.querySelector<HTMLElement>('[data-role="result"]')!;

  let current: HudStats | null = null;

  function setPhase(phase: Phase, stats?: HudStats): void {
    if (stats) {
      current = stats;
      seedEl.textContent = `seed ${stats.seed}`;
    }

    if (phase === 'intro') {
      title.textContent = '谁先撞墙？';
      title.style.opacity = '1';
      clock.style.opacity = '0';
      status.style.opacity = '0';
      result.style.opacity = '0';
      clock.textContent = '';
      status.innerHTML = '';
      result.innerHTML = '';
      return;
    }

    if (phase === 'race') {
      title.style.opacity = '0.35';
      clock.style.opacity = '1';
      status.style.opacity = '1';
      result.style.opacity = '0';
      result.innerHTML = '';
      if (current) {
        const elapsed = current.raceSeconds ?? 0;
        clock.textContent = `⏱ ${elapsed.toFixed(1)}s`;
        const elapsedSteps = (elapsed / RACE_DURATION_SECONDS) * DEFAULT_STEPS;
        status.innerHTML = current.race.balls
          .map((ball) => {
            const hit = ball.hitStep !== null && ball.hitStep <= elapsedSteps;
            return `<span class="hud-chip${hit ? ' is-hit' : ''}">${dot(
              ball.index,
            )}${ballLabel(ball)} ${hit ? '撞了' : '游走中'}</span>`;
          })
          .join('');
      }
      return;
    }

    if (phase === 'result') {
      title.style.opacity = '0.2';
      clock.style.opacity = '0';
      status.style.opacity = '0';
      result.style.opacity = '1';
      if (current) {
        const sorted = [...current.race.balls].sort((a, b) => {
          if (a.hitStep === null && b.hitStep === null) return a.index - b.index;
          if (a.hitStep === null) return 1;
          if (b.hitStep === null) return -1;
          return a.hitStep - b.hitStep;
        });
        const lines = sorted
          .map((ball) => {
            const winner = ball.index === current!.race.winnerIndex;
            const text =
              ball.hitStep === null
                ? '还在里面'
                : `${hitTimeSeconds(
                    ball.hitStep,
                    DEFAULT_STEPS,
                    RACE_DURATION_SECONDS,
                  ).toFixed(1)}s 撞墙`;
            return `<div class="hud-ball-line${winner ? ' is-winner' : ''}">
              ${dot(ball.index)}<span class="hud-ball-name">${ballLabel(
                ball,
              )}</span><span class="hud-ball-time">${text}</span>
            </div>`;
          })
          .join('');
        result.innerHTML = `${lines}<div class="hud-note">随机里，迟早有人先撞上</div>`;
      }
      return;
    }

    // reset
    title.style.opacity = '0';
    clock.style.opacity = '0';
    status.style.opacity = '0';
    result.style.opacity = '0';
  }

  return { setPhase };
}
