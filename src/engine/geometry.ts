import type { Vec2 } from './Vec2';

export const ORIGIN: Vec2 = { x: 0, y: 0 };

/**
 * 체비쇼프 반경 `radius` 안의 모든 칸(자기 자신 제외, 대각 포함) — `neighbors8`의 일반화.
 * `radius=1`이면 정확히 `neighbors8`과 같은 3×3-1=8칸을 반환한다. 시야 반경(§5.1,
 * `Params.visionRadius`)처럼 "플레이어 주변 몇 칸을 밝힐지"를 설정 가능하게 만들 때 쓴다.
 * 센서값 계산(§5.2, `World.sensorValueAt`)처럼 항상 고정 3×3이어야 하는 규칙에는
 * 여전히 `neighbors8`을 그대로 쓴다 — 그건 시야 범위와 무관한 별개의 게임 규칙이다.
 */
export function neighborsWithinRadius(pos: Vec2, radius: number): Vec2[] {
  const result: Vec2[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      result.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return result;
}

/** 8방향(대각 포함) 인접 칸 — §5.2 센서 범위(3×3, `World.sensorValueAt`)에 쓰이는
 * 고정 규칙. 이동 판정에는 쓰이지 않는다(§5.8 변경, 아래 isAdjacent4 참고). 시야
 * 반경처럼 크기를 바꿔야 하면 `neighborsWithinRadius`를 대신 쓸 것. */
export function neighbors8(pos: Vec2): Vec2[] {
  return neighborsWithinRadius(pos, 1);
}

/** 4방향(상하좌우) 인접 칸 */
export function neighbors4(pos: Vec2): Vec2[] {
  return [
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
  ];
}

/**
 * 맨해튼 거리 (4방향 이동 기준 최단 거리, §5.4 종료 보너스에 사용).
 * §5.8 기획 변경(대각 이동 제거)으로 chebyshevDistance 대신 이걸 쓴다 — 이제 실제로
 * 갈 수 있는 최단 경로 길이와 일치해야 하기 때문
 * ([[../../obsidian/projects/nan-2026/decisions/2026-07-23-remove-diagonal-movement]]).
 * 예전 대각 이동 버전은 src/mechanics/diagonalMovement.ts에 컴포넌트로 남아있다.
 */
export function manhattanDistance(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * a에서 b가 4방향(상하좌우) 인접인지 — 이동/해체/후퇴 등 모든 행동 대상 판정에 쓰인다
 * (§5.8 기획 변경: 대각 이동 제거). 예전 8방향 버전(isAdjacent8)은
 * src/mechanics/diagonalMovement.ts에 재사용 가능한 컴포넌트로 남아있다.
 */
export function isAdjacent4(a: Vec2, b: Vec2): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}
