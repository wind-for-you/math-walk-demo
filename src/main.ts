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
