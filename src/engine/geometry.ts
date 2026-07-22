import type { Vec2 } from './Vec2';

export const ORIGIN: Vec2 = { x: 0, y: 0 };

/** 8방향(대각 포함) 인접 칸 — §5.1/§5.2 시야·센서 범위(3×3)에 쓰인다. 이동 판정에는
 * 쓰이지 않는다(§5.8 변경, 아래 isAdjacent4 참고). */
export function neighbors8(pos: Vec2): Vec2[] {
  const result: Vec2[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      result.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return result;
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
