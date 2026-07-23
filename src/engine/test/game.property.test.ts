// 속성 테스트 (§11): 청크 결정성, 안전지대 불변식, 센서값 정합성, 턴 회계(행동수/라이프/콤보),
// 확정 칸 상태 불변성. 무작위 시드·무작위 행동 시퀀스를 반복해 불변식이 항상 유지되는지 검증한다.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CellStatus, createParams, Game, GamePhase, neighbors4, neighbors8, World } from '../index';
import type { Params, Vec2 } from '../index';

const PARAMS: Params = createParams({ actionBudget: 40, lives: 3 });

function key(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

describe('World 청크 생성', () => {
  it('같은 (worldSeed, cx, cy)는 항상 같은 지뢰 배치를 만든다 (결정성)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: -5, max: 5 }), fc.integer({ min: -5, max: 5 }), (seed, cx, cy) => {
        const w1 = new World(PARAMS, seed);
        const w2 = new World(PARAMS, seed);

        for (let dy = 0; dy < PARAMS.chunkSize; dy++) {
          for (let dx = 0; dx < PARAMS.chunkSize; dx++) {
            const pos = { x: cx * PARAMS.chunkSize + dx, y: cy * PARAMS.chunkSize + dy };
            expect(w1.isMine(pos)).toBe(w2.isMine(pos));
          }
        }
      }),
      { numRuns: 30 }
    );
  });

  it('시작 칸 중심 안전 지대(§5.1)에는 어떤 시드에서도 지뢰가 없다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const w = new World(PARAMS, seed);
        const half = Math.floor(PARAMS.safeRadius / 2);
        for (let y = -half; y <= half; y++) {
          for (let x = -half; x <= half; x++) {
            expect(w.isMine({ x, y })).toBe(false);
          }
        }
      }),
      { numRuns: 50 }
    );
  });

  it('센서값은 실제로 주변 8칸을 센 값과 항상 일치한다 (§5.2)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: -40, max: 40 }),
        fc.integer({ min: -40, max: 40 }),
        (seed, x, y) => {
          const w = new World(PARAMS, seed);
          const pos = { x, y };
          const expected = neighbors8(pos).filter((n) => w.isMine(n)).length;
          expect(w.sensorValueAt(pos)).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('World 유한 맵 경계 (mapSize)', () => {
  const FINITE_PARAMS: Params = createParams({ actionBudget: 40, lives: 3, mapSize: 21 });

  it('mapSize=0(기본값)이면 아무리 멀어도 항상 경계 안이다', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000, max: 10_000 }), fc.integer({ min: -10_000, max: 10_000 }), (x, y) => {
        const w = new World(PARAMS, 1);
        expect(w.isInBounds({ x, y })).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it('mapSize=21이면 |x|<=10, |y|<=10 안쪽만 경계 안이다', () => {
    const w = new World(FINITE_PARAMS, 1);
    expect(w.isInBounds({ x: 10, y: 10 })).toBe(true);
    expect(w.isInBounds({ x: -10, y: 0 })).toBe(true);
    expect(w.isInBounds({ x: 11, y: 0 })).toBe(false);
    expect(w.isInBounds({ x: 0, y: -11 })).toBe(false);
  });

  it('경계 밖 칸은 절대 지뢰가 아니다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 11, max: 40 }), (seed, offset) => {
        const w = new World(FINITE_PARAMS, seed);
        expect(w.isMine({ x: offset, y: 0 })).toBe(false);
        expect(w.isMine({ x: 0, y: offset })).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  it('유한 맵에서 플레이어는 경계 밖으로 이동 선언을 할 수 없다(벽처럼 막힘)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const game = new Game(FINITE_PARAMS, seed);
        // 시작 칸(원점)에서 맵 경계까지 4방향으로 계속 이동을 시도 — 경계 밖 선언은
        // 전부 무시되어야 하고(부작용 없음), 플레이어는 결코 경계를 벗어나지 않는다.
        for (let step = 0; step < 30; step++) {
          const target = { x: game.player.x + 1, y: game.player.y };
          game.declareMove(target);
          expect(Math.abs(game.player.x) <= 10 && Math.abs(game.player.y) <= 10).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });
});

function randomAgentStep(game: Game): void {
  const options = neighbors4(game.player);
  const target = options[Math.floor(Math.random() * options.length)]!;
  const rec = game.observations.get(key(target));
  const confirmed = rec !== undefined && rec.status !== CellStatus.OBSERVED;

  if (confirmed) game.retreat(target);
  else if (Math.random() < 0.5) game.declareMove(target);
  else game.declareDefuse(target);
}

describe('Game 턴 회계 불변식', () => {
  it('무작위 플레이 전 구간에서 행동수·라이프·콤보·확정 상태 불변식이 항상 유지된다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const game = new Game(PARAMS, seed);
        const confirmedStatusHistory = new Map<string, CellStatus>();
        const maxSteps = PARAMS.actionBudget + 5;

        for (let step = 0; step < maxSteps && game.phase === GamePhase.PLAYING; step++) {
          const prevActions = game.actionsRemaining;
          const prevLives = game.lives;
          const prevCombo = game.combo;

          randomAgentStep(game);

          // 1) 행동을 실제로 소비했다면 정확히 1만 줄어든다 (무효 입력은 아무 것도 바뀌지 않을 수 있다).
          expect(game.actionsRemaining).toBeLessThanOrEqual(prevActions);
          expect(prevActions - game.actionsRemaining).toBeGreaterThanOrEqual(0);
          expect(prevActions - game.actionsRemaining).toBeLessThanOrEqual(1);

          // 2) 라이프는 음수가 될 수 없다.
          expect(game.lives).toBeGreaterThanOrEqual(0);

          // 3) 콤보는 감소했다면 반드시 0이어야 한다 (오판 시 리셋, 그 외엔 유지되거나 +1).
          if (game.combo < prevCombo) expect(game.combo).toBe(0);

          // 4) 확정 칸 상태는 한 번 정해지면 다른 확정 상태로 바뀌지 않는다.
          for (const [k, rec] of game.observations) {
            if (rec.status === CellStatus.OBSERVED) continue;
            const prevStatus = confirmedStatusHistory.get(k);
            if (prevStatus === undefined) confirmedStatusHistory.set(k, rec.status);
            else expect(rec.status).toBe(prevStatus);
          }

          // 5) 해체 완료·크레이터 칸은 그 시점 이후 다시는 지뢰가 아니다.
          for (const [k, rec] of game.observations) {
            if (rec.status === CellStatus.DEFUSED || rec.status === CellStatus.CRATER) {
              const [x, y] = k.split(',').map(Number);
              expect(game.world.isMine({ x: x!, y: y! })).toBe(false);
            }
          }
        }

        // 6) 종료 조건: phase가 OVER라면 행동수 또는 라이프가 바닥났어야 한다.
        if (game.phase === GamePhase.OVER) {
          expect(game.actionsRemaining <= 0 || game.lives <= 0).toBe(true);
        }
      }),
      { numRuns: 60 }
    );
  });

  it('대각선 인접 칸은 더 이상 행동 대상이 아니다 (§5.8 기획 변경: 대각 이동 제거)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const game = new Game(PARAMS, seed);
        const player = game.player;
        const diagonalTargets: Vec2[] = [
          { x: player.x + 1, y: player.y + 1 },
          { x: player.x + 1, y: player.y - 1 },
          { x: player.x - 1, y: player.y + 1 },
          { x: player.x - 1, y: player.y - 1 },
        ];

        for (const target of diagonalTargets) {
          const before = { actionsRemaining: game.actionsRemaining, player: game.player, lives: game.lives };
          game.declareMove(target);
          expect(game.actionsRemaining).toBe(before.actionsRemaining);
          expect(game.player).toEqual(before.player);
          expect(game.lives).toBe(before.lives);
        }
      }),
      { numRuns: 30 }
    );
  });

  it('게임 종료 후에는 어떤 행동도 상태를 바꾸지 않는다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const game = new Game(PARAMS, seed);
        for (let step = 0; step < PARAMS.actionBudget + 5 && game.phase === GamePhase.PLAYING; step++) {
          randomAgentStep(game);
        }
        expect(game.phase).toBe(GamePhase.OVER);

        const snapshot = { score: game.score, lives: game.lives, actionsRemaining: game.actionsRemaining, player: game.player };
        randomAgentStep(game);
        randomAgentStep(game);

        expect(game.score).toBe(snapshot.score);
        expect(game.lives).toBe(snapshot.lives);
        expect(game.actionsRemaining).toBe(snapshot.actionsRemaining);
        expect(game.player).toEqual(snapshot.player);
      }),
      { numRuns: 30 }
    );
  });
});
