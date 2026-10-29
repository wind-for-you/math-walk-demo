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
