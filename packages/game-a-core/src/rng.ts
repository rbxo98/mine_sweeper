// 시드 기반 PRNG (mulberry32급, §10.3). 지뢰 배치·이동에만 사용해 재현성을 보장한다.
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

export interface WeightedOption<T> {
  value: T;
  weight: number;
}

export function weightedPick<T>(rng: RNG, options: readonly WeightedOption<T>[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = rng() * total;
  for (const option of options) {
    if (r < option.weight) return option.value;
    r -= option.weight;
  }
  return options[options.length - 1]!.value;
}
