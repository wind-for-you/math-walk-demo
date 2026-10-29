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
