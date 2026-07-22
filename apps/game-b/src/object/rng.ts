// 시드 기반 PRNG (mulberry32급, §10.3). 청크 지뢰 배치에만 사용해 재현성을 보장한다.
// DOM에 의존하지 않으므로 브라우저/Node(헤드리스 시뮬레이터·테스트) 어디서든 동일하게 동작한다.

export type RNG = () => number; // [0, 1) 반환

export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: RNG, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function shuffle<T>(rng: RNG, items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 월드 시드 → 청크 시드 파생 (§5.6, §10.3): 탐사 방향과 무관하게 같은 (worldSeed, cx, cy)는
 * 항상 같은 정수를 반환한다. 암호학적 해시가 아닌 단순 정수 믹서(FNV-1a류)면 충분하다 —
 * 청크 지뢰 배치용 PRNG의 시드로만 쓰이기 때문.
 */
export function hashSeed(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h ^= part | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
  }
  return h >>> 0;
}
