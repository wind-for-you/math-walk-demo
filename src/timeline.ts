export type Phase = 'intro' | 'race' | 'result' | 'reset';

export const LOOP_DURATION = 28;

export const PHASE_BOUNDS = {
  introEnd: 2,
  raceEnd: 22,
  resultEnd: 26,
  resetEnd: 28,
} as const;

/** 竞速段墙钟时长（秒） */
export const RACE_DURATION_SECONDS =
  PHASE_BOUNDS.raceEnd - PHASE_BOUNDS.introEnd;

/**
 * 单摆物理赛程（秒）：20s 竞速段用慢放呈现这 2.4s 的摆动，
 * 摆稳的悬念铺满整段，砸中后再留时间看阻尼收场。
 */
export const RACE_SIM_SECONDS = 2.4;

/** 慢放倍数：墙钟时长 / 物理时长 ≈ 8.3× */
export const SLOW_MO_FACTOR = RACE_DURATION_SECONDS / RACE_SIM_SECONDS;

/** 竞速进度 → 物理时间（秒），夹在 [0, RACE_SIM_SECONDS] */
export function raceSimTime(raceProgress: number): number {
  return clamp01(raceProgress) * RACE_SIM_SECONDS;
}

export type TimelineState = {
  phase: Phase;
  localTime: number;
  loopTime: number;
  raceProgress: number;
  resultProgress: number;
  resetProgress: number;
};

function positiveMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function phaseAt(t: number): Phase {
  const loopTime = positiveMod(t, LOOP_DURATION);
  if (loopTime < PHASE_BOUNDS.introEnd) return 'intro';
  if (loopTime < PHASE_BOUNDS.raceEnd) return 'race';
  if (loopTime < PHASE_BOUNDS.resultEnd) return 'result';
  return 'reset';
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function getTimelineState(elapsedSeconds: number): TimelineState {
  const loopTime = positiveMod(elapsedSeconds, LOOP_DURATION);
  const phase = phaseAt(loopTime);

  const raceDur = RACE_DURATION_SECONDS; // 20
  const resultDur = PHASE_BOUNDS.resultEnd - PHASE_BOUNDS.raceEnd; // 4
  const resetDur = PHASE_BOUNDS.resetEnd - PHASE_BOUNDS.resultEnd; // 2

  let raceProgress = 0;
  if (loopTime >= PHASE_BOUNDS.raceEnd) raceProgress = 1;
  else if (loopTime > PHASE_BOUNDS.introEnd) {
    raceProgress = (loopTime - PHASE_BOUNDS.introEnd) / raceDur;
  }

  let resultProgress = 0;
  if (loopTime >= PHASE_BOUNDS.resultEnd) resultProgress = 1;
  else if (loopTime > PHASE_BOUNDS.raceEnd) {
    resultProgress = (loopTime - PHASE_BOUNDS.raceEnd) / resultDur;
  }

  let resetProgress = 0;
  if (loopTime >= PHASE_BOUNDS.resultEnd) {
    resetProgress = (loopTime - PHASE_BOUNDS.resultEnd) / resetDur;
  }

  let localTime = loopTime;
  if (phase === 'intro') localTime = loopTime;
  else if (phase === 'race') localTime = loopTime - PHASE_BOUNDS.introEnd;
  else if (phase === 'result') localTime = loopTime - PHASE_BOUNDS.raceEnd;
  else localTime = loopTime - PHASE_BOUNDS.resultEnd;

  return {
    phase,
    localTime,
    loopTime,
    raceProgress: clamp01(raceProgress),
    resultProgress: clamp01(resultProgress),
    resetProgress: clamp01(resetProgress),
  };
}
