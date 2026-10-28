import { describe, it, expect } from 'vitest';
import { createRng, hashStringToSeed } from '../src/rng';

describe('createRng', () => {
  it('同一 seed 产生相同序列', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('不同 seed 产生不同序列', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });

  it('输出落在 [0, 1)', () => {
    const rng = createRng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashStringToSeed', () => {
  it('同一字符串得到同一 seed', () => {
    expect(hashStringToSeed('42')).toBe(hashStringToSeed('42'));
  });

  it('不同字符串倾向不同 seed', () => {
    expect(hashStringToSeed('42')).not.toBe(hashStringToSeed('43'));
  });

  it('纯数字字符串可解析为该数字（若在 uint32 范围）', () => {
    expect(hashStringToSeed('42')).toBe(42);
  });
});
