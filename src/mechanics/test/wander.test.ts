import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { wanderStep, type WanderEntity } from '../wander';

type Vec2 = { x: number; y: number };

function key(p: Vec2): string {
  return `${p.x},${p.y}`;
}

function neighbors4(p: Vec2): Vec2[] {
  return [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ];
}

describe('wanderStep', () => {
  it('반환 맵에는 pinned 여부와 무관하게 모든 엔티티가 정확히 한 번씩 들어있다', () => {
    const entities: WanderEntity<string, Vec2>[] = [
      { key: 'a', position: { x: 0, y: 0 } },
      { key: 'b', position: { x: 5, y: 5 }, pinned: true },
      { key: 'c', position: { x: 2, y: 2 } },
    ];
    const result = wanderStep(createRng(1), entities, {
      stayBias: 1,
      neighborsOf: neighbors4,
      isBlocked: () => false,
      positionKey: key,
    });
    expect(result.size).toBe(3);
    expect([...result.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('pinned 엔티티는 항상 원래 좌표 그대로 반환된다', () => {
    const entities: WanderEntity<string, Vec2>[] = [{ key: 'a', position: { x: 3, y: 4 }, pinned: true }];
    const result = wanderStep(createRng(42), entities, {
      stayBias: 1,
      neighborsOf: neighbors4,
      isBlocked: () => false,
      positionKey: key,
    });
    expect(result.get('a')).toEqual({ x: 3, y: 4 });
  });

  it('isBlocked가 모든 이웃을 막으면 pinned 아닌 엔티티도 제자리에 머문다', () => {
    const start = { x: 0, y: 0 };
    const entities: WanderEntity<string, Vec2>[] = [{ key: 'a', position: start }];
    const result = wanderStep(createRng(7), entities, {
      stayBias: 1,
      neighborsOf: neighbors4,
      isBlocked: () => true,
      positionKey: key,
    });
    expect(result.get('a')).toEqual(start);
  });

  it('결과 좌표는 항상 자기 자신 또는 막히지 않은 이웃 중 하나다(임의의 곳으로 순간이동하지 않는다)', () => {
    const start = { x: 0, y: 0 };
    const allowed = new Set([key(start), ...neighbors4(start).map(key)]);

    for (let seed = 0; seed < 50; seed++) {
      const entities: WanderEntity<string, Vec2>[] = [{ key: 'a', position: start }];
      const result = wanderStep(createRng(seed), entities, {
        stayBias: 1,
        neighborsOf: neighbors4,
        isBlocked: () => false,
        positionKey: key,
      });
      expect(allowed.has(key(result.get('a')!))).toBe(true);
    }
  });

  it('같은 턴에 두 엔티티가 같은 칸으로 겹쳐 이동하지 않는다(점유 회피)', () => {
    // 서로 인접한 두 엔티티가 좁은 공간(이웃이 서로뿐)에서 여러 시드로 반복해도
    // 최종적으로 같은 칸을 공유하지 않아야 한다.
    for (let seed = 0; seed < 100; seed++) {
      const entities: WanderEntity<string, Vec2>[] = [
        { key: 'a', position: { x: 0, y: 0 } },
        { key: 'b', position: { x: 1, y: 0 } },
      ];
      const result = wanderStep(createRng(seed), entities, {
        stayBias: 0.1, // 이동을 적극적으로 시도하게 해 충돌 가능성을 높인다
        neighborsOf: neighbors4,
        isBlocked: () => false,
        positionKey: key,
      });
      const posA = key(result.get('a')!);
      const posB = key(result.get('b')!);
      expect(posA).not.toBe(posB);
    }
  });

  it('entities 배열 자체는 변경하지 않는다(순수 함수)', () => {
    const entities: WanderEntity<string, Vec2>[] = [{ key: 'a', position: { x: 0, y: 0 } }];
    const snapshot = JSON.parse(JSON.stringify(entities));
    wanderStep(createRng(3), entities, {
      stayBias: 0.1,
      neighborsOf: neighbors4,
      isBlocked: () => false,
      positionKey: key,
    });
    expect(entities).toEqual(snapshot);
  });
});
