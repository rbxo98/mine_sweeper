import type { Vec2 } from './Vec2';

export const ORIGIN: Vec2 = { x: 0, y: 0 };

/** 8방향(대각 포함) 인접 칸 — §5.8 "대각 이동 8방향 모두 허용" */
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

/** 체비쇼프 거리 (8방향 이동 기준 최단 거리, §5.4 종료 보너스에 사용) */
export function chebyshevDistance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** a에서 b가 8방향 인접(대각 포함)인지 — 자기 자신은 인접이 아니다 */
export function isAdjacent8(a: Vec2, b: Vec2): boolean {
  if (a.x === b.x && a.y === b.y) return false;
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}
