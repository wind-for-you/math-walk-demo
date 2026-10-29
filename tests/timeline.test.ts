import { describe, it, expect } from 'vitest';
import {
  phaseAt,
  getTimelineState,
  LOOP_DURATION,
  PHASE_BOUNDS,
} from '../src/timeline';

describe('常量', () => {
  it('循环 24 秒，边界 2 / 18 / 22 / 24', () => {
    expect(LOOP_DURATION).toBe(24);
    expect(PHASE_BOUNDS.introEnd).toBe(2);
    expect(PHASE_BOUNDS.walkEnd).toBe(18);
    expect(PHASE_BOUNDS.compareEnd).toBe(22);
    expect(PHASE_BOUNDS.resetEnd).toBe(24);
  });
});

describe('phaseAt', () => {
  it('边界分段', () => {
    expect(phaseAt(0)).toBe('intro');
    expect(phaseAt(1.9)).toBe('intro');
    expect(phaseAt(2)).toBe('walk');
    expect(phaseAt(10)).toBe('walk');
    expect(phaseAt(17.9)).toBe('walk');
    expect(phaseAt(18)).toBe('compare');
    expect(phaseAt(20)).toBe('compare');
    expect(phaseAt(22)).toBe('reset');
    expect(phaseAt(23.9)).toBe('reset');
  });

  it('对 >=24 取模', () => {
    expect(phaseAt(24)).toBe('intro');
    expect(phaseAt(26)).toBe('walk');
    expect(phaseAt(48 + 19)).toBe('compare');
  });
});

describe('getTimelineState', () => {
  it('intro 时 walkProgress=0', () => {
    const s = getTimelineState(1);
    expect(s.phase).toBe('intro');
    expect(s.walkProgress).toBe(0);
    expect(s.compareProgress).toBe(0);
    expect(s.resetProgress).toBe(0);
  });

  it('walk 中点 progress ≈ 0.5', () => {
    // walk: 2–18 → 时长 16；t=10 → (10-2)/16 = 0.5
    const s = getTimelineState(10);
    expect(s.phase).toBe('walk');
    expect(s.walkProgress).toBeCloseTo(0.5, 5);
  });

  it('compare 开始时 walkProgress=1，compareProgress=0', () => {
    const s = getTimelineState(18);
    expect(s.phase).toBe('compare');
    expect(s.walkProgress).toBe(1);
    expect(s.compareProgress).toBe(0);
  });

  it('compare 中点 compareProgress=0.5', () => {
    // compare: 18–22 → 时长 4；t=20 → 0.5
    const s = getTimelineState(20);
    expect(s.compareProgress).toBeCloseTo(0.5, 5);
  });

  it('reset 中点 resetProgress=0.5', () => {
    // reset: 22–24 → 时长 2；t=23 → 0.5
    const s = getTimelineState(23);
    expect(s.phase).toBe('reset');
    expect(s.resetProgress).toBeCloseTo(0.5, 5);
    expect(s.walkProgress).toBe(1);
    expect(s.compareProgress).toBe(1);
  });

  it('跨圈取模', () => {
    const s = getTimelineState(24 + 10);
    expect(s.loopTime).toBeCloseTo(10, 5);
    expect(s.phase).toBe('walk');
  });
});
