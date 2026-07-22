// src/engine과 같은 최소 RNG 유틸을 여기서도 독립적으로 들고 있는다 — src/mechanics는
// src/engine에 의존하지 않는, 엔진/좌표계 독립적인 재사용 가능 모듈이어야 하기 때문에
// 의도적으로 중복시켰다.

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
