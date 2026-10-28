/** mulberry32: 可种子 PRNG，返回 [0, 1) */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 将 URL 参数字符串转为 uint32 seed。
 * 若整串为十进制整数且在 [0, 2^32) 内，直接使用该值；否则做字符串哈希。
 */
export function hashStringToSeed(input: string): number {
  const asNum = Number(input);
  if (
    input.trim() !== '' &&
    Number.isInteger(asNum) &&
    asNum >= 0 &&
    asNum < 2 ** 32
  ) {
    return asNum >>> 0;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
