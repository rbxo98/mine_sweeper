import { describe, expect, it } from 'vitest';
import { chebyshevDistance, isAdjacent8, neighbors8Of } from '../diagonalMovement';

describe('neighbors8Of', () => {
  it('중심을 제외한 8칸을 반환한다', () => {
    const result = neighbors8Of({ x: 0, y: 0 });
    expect(result).toHaveLength(8);
    expect(result).not.toContainEqual({ x: 0, y: 0 });
    expect(result).toContainEqual({ x: 1, y: 1 });
    expect(result).toContainEqual({ x: -1, y: -1 });
  });
});

describe('isAdjacent8', () => {
  it('대각선 칸도 인접으로 취급한다', () => {
    expect(isAdjacent8({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
    expect(isAdjacent8({ x: 0, y: 0 }, { x: -1, y: 1 })).toBe(true);
  });

  it('직교 인접 칸도 인접이다', () => {
    expect(isAdjacent8({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });

  it('자기 자신은 인접이 아니다', () => {
    expect(isAdjacent8({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it('2칸 이상 떨어지면 인접이 아니다', () => {
    expect(isAdjacent8({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });
});

describe('chebyshevDistance', () => {
  it('대각선 한 칸도 거리 1로 센다', () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
  });

  it('축 방향은 좌표 차의 최댓값이다', () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
  });
});
