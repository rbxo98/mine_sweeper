// 지뢰추적자(A)의 "이동하는 지뢰" 알고리즘을 좌표 타입/인접 규칙과 무관한 순수 함수로 뽑은
// 것. 원래 game-a-core Game.moveMines였다 ([[decisions/2026-07-22-cherry-pick-a-into-b]]).
//
// A는 유한 그리드(최대 30×16)라 지뢰 전체를 매 턴 옮길 수 있었지만, B의 지뢰밭은 청크 단위
// 무한 절차생성(World)이라 "전체 지뢰 목록"이라는 개념 자체가 없다 — 그래서 이 함수는
// "어떤 개체들을 옮길지"는 전혀 모르고 넘겨받은 entities만 옮긴다. B에서 실제로 쓰려면
// "플레이어 반경 안의 지뢰만 이번 이동 페이즈 대상으로 스코프하기" 같은 레이어를 호출자가
// 별도로 만들어야 한다 — 그 설계는 아직 하지 않았다(백로그).

import { type RNG, shuffle, type WeightedOption, weightedPick } from './rng';

export interface WanderEntity<TKey extends string, TPos> {
  key: TKey;
  position: TPos;
  /** true면 이번 이동 페이즈에서 제외(예: 깃발로 고정된 지뢰). */
  pinned?: boolean;
}

export interface WanderOptions<TPos> {
  /** 제자리에 머물 때의 가중치 — 클수록 이동을 덜 하려는 성향(A의 stayBias). */
  stayBias: number;
  /** 후보 이웃 좌표 목록(4방향/8방향 등 인접 규칙은 호출자가 정한다). */
  neighborsOf: (pos: TPos) => TPos[];
  /** 그 좌표로 이동할 수 없는지(예: 아직 공개 안 된 칸이어야 함, 맵 경계 등). */
  isBlocked: (pos: TPos) => boolean;
  /** 좌표를 점유 판정용 문자열 키로 변환. */
  positionKey: (pos: TPos) => string;
}

/**
 * 한 번의 이동 페이즈: pinned 아닌 개체들을 무작위 순서로 하나씩, "제자리 유지" 또는
 * "막히지 않고 아직 비어있는 이웃 중 하나"로 가중치 기반 이동시킨다. 순수 함수 — 입력
 * 배열은 변경하지 않고 key → 새 좌표 맵을 반환한다. 호출자가 자신의 엔티티 표현에 맞게
 * 이 결과를 적용하면 된다.
 *
 * 반환 맵에는 pinned 여부와 무관하게 entities의 모든 키가 정확히 하나씩 들어간다 —
 * pinned 개체나 "제자리를 택한" 개체는 원래 좌표와 동일한 값으로 들어있다(호출자가
 * "이 키는 왜 안 옮겨졌지?"를 신경 쓸 필요 없이 항상 맵을 그대로 적용하면 되도록).
 */
export function wanderStep<TKey extends string, TPos>(
  rng: RNG,
  entities: readonly WanderEntity<TKey, TPos>[],
  options: WanderOptions<TPos>
): Map<TKey, TPos> {
  const result = new Map<TKey, TPos>();
  const occupied = new Set(entities.map((e) => options.positionKey(e.position)));

  for (const entity of entities) {
    if (entity.pinned) result.set(entity.key, entity.position);
  }

  const movable = shuffle(rng, entities.filter((e) => !e.pinned));

  for (const entity of movable) {
    occupied.delete(options.positionKey(entity.position));

    const candidates: WeightedOption<TPos>[] = [{ value: entity.position, weight: options.stayBias }];
    for (const n of options.neighborsOf(entity.position)) {
      const key = options.positionKey(n);
      if (!options.isBlocked(n) && !occupied.has(key)) candidates.push({ value: n, weight: 1 });
    }

    const chosen = weightedPick(rng, candidates);
    result.set(entity.key, chosen);
    occupied.add(options.positionKey(chosen));
  }

  return result;
}
