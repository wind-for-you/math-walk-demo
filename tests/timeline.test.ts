import { describe, it, expect } from 'vitest';
import {
  phaseAt,
  getTimelineState,
  raceSimTime,
  LOOP_DURATION,
  PHASE_BOUNDS,
  RACE_DURATION_SECONDS,
  RACE_SIM_SECONDS,
  SLOW_MO_FACTOR,
} from '../src/timeline';

describe('常量', () => {
  it('循环 28 秒，边界 2 / 22 / 26 / 28', () => {
    expect(LOOP_DURATION).toBe(28);
    expect(PHASE_BOUNDS.introEnd).toBe(2);
    expect(PHASE_BOUNDS.raceEnd).toBe(22);
    expect(PHASE_BOUNDS.resultEnd).toBe(26);
    expect(PHASE_BOUNDS.resetEnd).toBe(28);
  });
});

describe('phaseAt', () => {
  it('边界分段', () => {
    expect(phaseAt(0)).toBe('intro');
    expect(phaseAt(1.9)).toBe('intro');
    expect(phaseAt(2)).toBe('race');
    expect(phaseAt(10)).toBe('race');
    expect(phaseAt(21.9)).toBe('race');
    expect(phaseAt(22)).toBe('result');
    expect(phaseAt(24)).toBe('result');
    expect(phaseAt(26)).toBe('reset');
    expect(phaseAt(27.9)).toBe('reset');
  });

  it('对 >=28 取模', () => {
    expect(phaseAt(28)).toBe('intro');
    expect(phaseAt(30)).toBe('race');
    expect(phaseAt(48 + 19)).toBe('race');
    expect(phaseAt(56 + 23)).toBe('result');
  });
});

describe('单摆赛程慢放', () => {
  it('2.4s 物理赛程铺满 20s 竞速段', () => {
    expect(RACE_SIM_SECONDS).toBe(2.4);
    expect(RACE_DURATION_SECONDS).toBe(20);
    expect(SLOW_MO_FACTOR).toBeCloseTo(20 / 2.4, 10);
  });

  it('raceSimTime 线性映射并夹紧', () => {
    expect(raceSimTime(0)).toBe(0);
    expect(raceSimTime(0.5)).toBeCloseTo(1.2, 10);
    expect(raceSimTime(1)).toBe(RACE_SIM_SECONDS);
    expect(raceSimTime(-1)).toBe(0);
    expect(raceSimTime(2)).toBe(RACE_SIM_SECONDS);
  });
});

describe('getTimelineState', () => {
  it('intro 时 raceProgress=0', () => {
    const s = getTimelineState(1);
    expect(s.phase).toBe('intro');
    expect(s.raceProgress).toBe(0);
    expect(s.resultProgress).toBe(0);
    expect(s.resetProgress).toBe(0);
  });

  it('race 中点 progress ≈ 0.5', () => {
    // race: 2–22 → 时长 20；t=12 → (12-2)/20 = 0.5
    const s = getTimelineState(12);
    expect(s.phase).toBe('race');
    expect(s.raceProgress).toBeCloseTo(0.5, 5);
  });

  it('result 开始时 raceProgress=1，resultProgress=0', () => {
    const s = getTimelineState(22);
    expect(s.phase).toBe('result');
    expect(s.raceProgress).toBe(1);
    expect(s.resultProgress).toBe(0);
  });

  it('result 中点 resultProgress=0.5', () => {
    // result: 22–26 → 时长 4；t=24 → 0.5
    const s = getTimelineState(24);
    expect(s.resultProgress).toBeCloseTo(0.5, 5);
  });

  it('reset 中点 resetProgress=0.5', () => {
    // reset: 26–28 → 时长 2；t=27 → 0.5
    const s = getTimelineState(27);
    expect(s.phase).toBe('reset');
    expect(s.resetProgress).toBeCloseTo(0.5, 5);
    expect(s.raceProgress).toBe(1);
    expect(s.resultProgress).toBe(1);
  });

  it('跨圈取模', () => {
    const s = getTimelineState(28 + 12);
    expect(s.loopTime).toBeCloseTo(12, 5);
    expect(s.phase).toBe('race');
  });
});
