import { describe, expect, it } from 'vitest';
import { neighbors8, neighborsWithinRadius } from '../geometry';

describe('neighborsWithinRadius', () => {
  it('radius=0이면 중심 자신을 제외하고 아무 칸도 없다', () => {
    expect(neighborsWithinRadius({ x: 5, y: -3 }, 0)).toEqual([]);
  });

  it('radius=1은 neighbors8과 정확히 같은 8칸 집합을 반환한다', () => {
    const pos = { x: 2, y: 7 };
    const radiusResult = new Set(neighborsWithinRadius(pos, 1).map((p) => `${p.x},${p.y}`));
    const legacyResult = new Set(neighbors8(pos).map((p) => `${p.x},${p.y}`));
    expect(radiusResult).toEqual(legacyResult);
    expect(radiusResult.size).toBe(8);
  });

  it('radius=2는 5×5-1=24칸을 반환하고 중심은 포함하지 않는다', () => {
    const pos = { x: 0, y: 0 };
    const result = neighborsWithinRadius(pos, 2);
    expect(result).toHaveLength(24);
    expect(result).not.toContainEqual({ x: 0, y: 0 });
    // 반경 경계(체비쇼프 거리 2)와 그 안쪽 모두 포함해야 한다.
    expect(result).toContainEqual({ x: 2, y: 2 });
    expect(result).toContainEqual({ x: -2, y: 0 });
    expect(result).toContainEqual({ x: 1, y: 0 });
    // 반경 밖은 포함하지 않는다.
    expect(result).not.toContainEqual({ x: 3, y: 0 });
  });

  it('임의의 반경에서도 항상 (2r+1)^2 - 1개의 칸을 반환한다', () => {
    for (const radius of [1, 2, 3, 4]) {
      const result = neighborsWithinRadius({ x: 10, y: -10 }, radius);
      expect(result).toHaveLength((2 * radius + 1) ** 2 - 1);
    }
  });
});
