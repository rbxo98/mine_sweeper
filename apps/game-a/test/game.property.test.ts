// 속성 테스트 (§11): 지뢰 수 보존, 공개 칸에 지뢰 없음, 숫자-지뢰 정합, 묶음 수 ≤ bundleLife.
// 무작위 행동 시퀀스를 여러 시드로 반복해 불변식이 항상 유지되는지 검증한다.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createParams, createRng, EXPLOSION_LABEL, Game, GroundVisual, Phase, vecKey } from 'game-a-core';
import type { Params, Vec2 } from 'game-a-core';

const PARAMS: Params = createParams({ width: 7, height: 7, mineCount: 4, bundleLife: 2, stayBias: 1.0 });
const STEPS_PER_GAME = 40;
const NUM_RUNS = 60;

function pickRandomAction(
  rng: () => number,
  hidden: Vec2[]
): { type: 'reveal'; cells: Vec2[] } | { type: 'flag'; cell: Vec2 } {
  if (hidden.length === 0) return { type: 'reveal', cells: [] };
  if (rng() < 0.25) {
    const idx = Math.floor(rng() * hidden.length);
    return { type: 'flag', cell: hidden[idx]! };
  }
  const count = 1 + Math.floor(rng() * Math.min(3, hidden.length));
  const shuffled = [...hidden].sort(() => rng() - 0.5);
  return { type: 'reveal', cells: shuffled.slice(0, count) };
}

function expectedNumberAt(mineKeys: Set<string>, width: number, height: number, c: Vec2): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (mineKeys.has(`${nx},${ny}`)) count += 1;
    }
  }
  return count;
}

describe('game-a Game 클래스 불변식', () => {
  it('무작위 플레이 전 구간에서 5가지 불변식이 항상 유지된다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const rng = createRng(seed);
        const game = new Game(PARAMS, rng);

        for (let step = 0; step < STEPS_PER_GAME && game.phase === Phase.PLAYING; step++) {
          const hidden = game.board.allCells().filter((c) => c.isHidden).map((c) => c.position);
          if (hidden.length === 0) break;

          const action = pickRandomAction(rng, hidden);
          if (action.type === 'reveal') game.reveal(action.cells);
          else game.flag(action.cell);

          // 1) 지뢰 수 보존
          expect(game.mines.length).toBe(PARAMS.mineCount);

          const mineKeys = new Set(game.mines.map((m) => vecKey(m.position)));

          // 2), 3)은 "진행 중" 상태에서만 성립한다. 패배 시에는 폭발 지점을 §5.8/§6.2
          // 규칙에 따라 의도적으로 지뢰가 있는 채로 공개 표시하므로 이 두 불변식의 예외다.
          if (game.phase === Phase.PLAYING) {
            for (const cell of game.board.allCells()) {
              if (cell.visual === GroundVisual.REVEALED) {
                // 2) 공개된 칸에는 지뢰가 없다
                expect(mineKeys.has(vecKey(cell.position))).toBe(false);
                // 3) 공개 칸 숫자는 실제 인접 지뢰 수와 일치한다
                expect(cell.adjacentMineCount).toBe(expectedNumberAt(mineKeys, PARAMS.width, PARAMS.height, cell.position));
              }
            }
          }

          // 4) 유지되는 공개 묶음 수는 bundleLife를 넘지 않는다
          expect(game.bundles.length).toBeLessThanOrEqual(PARAMS.bundleLife);

          // 5) 폭발 지점 라벨이 붙은 칸은 실제 지뢰 위치와 항상 일치한다 — 한 번에 여러 칸을
          // 선택해 공개했을 때 지뢰가 아닌 칸까지 폭발로 표시되던 버그의 회귀 방지.
          for (const cell of game.board.allCells()) {
            if (cell.bundleLabel === EXPLOSION_LABEL) {
              expect(mineKeys.has(vecKey(cell.position))).toBe(true);
            }
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('첫 공개에서 여러 칸을 선택해도 가장 먼저 선택한 칸만 안전이 보장된다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const rng = createRng(seed);
        const game = new Game(PARAMS, rng);

        // 대각선으로 3~4칸을 순서대로 선택 — cells[0]이 "가장 먼저 클릭한 칸"이라는 전제.
        const cells: Vec2[] = [];
        for (let i = 0; i < 4 && i < PARAMS.width && i < PARAMS.height; i++) cells.push({ x: i, y: i });

        game.reveal(cells);

        const mineKeys = new Set(game.mines.map((m) => vecKey(m.position)));
        // 가장 먼저 선택한 칸(cells[0])은 항상 안전하다.
        expect(mineKeys.has(vecKey(cells[0]!))).toBe(false);
        // (나머지 칸은 안전이 보장되지 않는다 — 패배해도 정상이므로 별도로 단언하지 않는다.)
      }),
      { numRuns: 200 }
    );
  });
});
