// B(지뢰밭정찰대)의 원래 §5.8 규칙("대각 이동 8방향 모두 허용")이었으나 기획 변경으로
// 현재 게임에서는 더 이상 쓰지 않는다(4방향 이동으로 축소, src/engine/geometry.ts의
// isAdjacent4/manhattanDistance 참고). 다만 "칸을 골라 행동한다"는 다른 보드 기반
// 게임/모드에서 다시 필요할 수 있는 재사용 가능한 조각이라 여기 컴포넌트로 보존한다
// ([[decisions/2026-07-23-remove-diagonal-movement]] 참고). 엔진/좌표계 독립적이도록
// src/engine에 의존하지 않고 최소 좌표 타입만 쓴다.

export interface Point {
  x: number;
  y: number;
}

/** 8방향(대각 포함) 인접 칸 */
export function neighbors8Of(pos: Point): Point[] {
  const result: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      result.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return result;
}

/** 체비쇼프 거리 (8방향 이동 기준 최단 거리) */
export function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** a에서 b가 8방향 인접(대각 포함)인지 — 자기 자신은 인접이 아니다 */
export function isAdjacent8(a: Point, b: Point): boolean {
  if (a.x === b.x && a.y === b.y) return false;
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}
