// 헤드리스 시뮬레이터 (§10.2, §11 P1 범위): src/object만 import하고 DOM에 의존하지 않는다.
// 지금은 무작위 에이전트로 Game 클래스가 끝까지 정상 동작하는지 확인하는 용도.
// 회피형/추론형 에이전트와 파라미터 스윕은 P3에서 추가한다.
// 맵 생성(worldSeed)은 재현성이 필요하지만, 에이전트의 선택 자체는 게임 코어가 아니므로
// game-a sim과 동일하게 Math.random()을 그대로 쓴다.
import { createParams, Game, GamePhase } from '../index';
import type { Params, Vec2 } from '../index';
import { neighbors8 } from '../index';

function isConfirmed(game: Game, pos: Vec2): boolean {
  const rec = game.observations.get(`${pos.x},${pos.y}`);
  return rec !== undefined && rec.status !== 'observed';
}

function playOneGame(worldSeed: number, params: Params) {
  const game = new Game(params, worldSeed);
  const maxSteps = params.actionBudget + 5; // 안전장치 — 정상 동작이면 actionBudget 안에서 끝난다.

  for (let step = 0; step < maxSteps && game.phase === GamePhase.PLAYING; step++) {
    const options = neighbors8(game.player);
    const target = options[Math.floor(Math.random() * options.length)]!;

    if (isConfirmed(game, target)) {
      game.retreat(target);
    } else if (Math.random() < 0.5) {
      game.declareMove(target);
    } else {
      game.declareDefuse(target);
    }
  }

  return game;
}

function main(): void {
  const params = createParams(); // 기본 모드: actionBudget 80, lives 3
  const runs = 200;

  let totalScore = 0;
  let totalVisits = 0;
  let totalDefuses = 0;
  let totalExplosions = 0;
  let totalFumbles = 0;
  let totalMaxDistance = 0;
  let totalMaxCombo = 0;
  let livesExhausted = 0;

  for (let i = 0; i < runs; i++) {
    const game = playOneGame(1000 + i, params);
    totalScore += game.score;
    totalVisits += game.visitCount;
    totalDefuses += game.defuseCount;
    totalExplosions += game.explosionCount;
    totalFumbles += game.fumbleCount;
    totalMaxDistance += game.maxDistance;
    totalMaxCombo += game.maxCombo;
    if (game.lives <= 0) livesExhausted += 1;
  }

  console.log(`[game-b sim] 무작위 에이전트 ${runs}판 (actionBudget=${params.actionBudget}, lives=${params.lives})`);
  console.log(`  평균 점수: ${(totalScore / runs).toFixed(1)}`);
  console.log(`  평균 탐사 칸: ${(totalVisits / runs).toFixed(1)}  평균 해체: ${(totalDefuses / runs).toFixed(1)}`);
  console.log(`  평균 폭발: ${(totalExplosions / runs).toFixed(1)}  평균 헛손질: ${(totalFumbles / runs).toFixed(1)}`);
  console.log(`  평균 최대 도달 거리: ${(totalMaxDistance / runs).toFixed(1)}  평균 최대 콤보: ${(totalMaxCombo / runs).toFixed(1)}`);
  console.log(`  라이프 소진으로 조기 종료한 판: ${((livesExhausted / runs) * 100).toFixed(1)}%`);
}

main();
