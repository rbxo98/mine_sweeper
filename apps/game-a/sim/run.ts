// 헤드리스 시뮬레이터 (§10.2, §11 P1 범위): src/object만 import하고 DOM에 의존하지 않는다.
// 지금은 무작위 에이전트로 Game 클래스가 끝까지 정상 동작하는지 확인하는 용도.
// 휴리스틱/정밀 추적 에이전트와 파라미터 스윕은 P3에서 추가한다.
import { createParams, createRng, Game, Phase } from '../src/object';
import type { Params, Vec2 } from '../src/object';

function allHiddenCells(game: Game): Vec2[] {
  return game.board.allCells().filter((c) => c.isHidden).map((c) => c.position);
}

function playOneGame(seed: number, params: Params) {
  const rng = createRng(seed);
  const game = new Game(params, rng);
  const maxSteps = 500;

  for (let step = 0; step < maxSteps && game.phase === Phase.PLAYING; step++) {
    const hidden = allHiddenCells(game);
    if (hidden.length === 0) break;

    const wantsFlag = Math.random() < 0.3 && game.flagsRemaining > 0;
    if (wantsFlag) {
      const cell = hidden[Math.floor(Math.random() * hidden.length)]!;
      game.flag(cell);
    } else {
      const count = 1 + Math.floor(Math.random() * Math.min(3, hidden.length));
      const shuffled = [...hidden].sort(() => Math.random() - 0.5);
      game.reveal(shuffled.slice(0, count));
    }
  }

  return { phase: game.phase, actionCount: game.actionCount };
}

function main(): void {
  const params = createParams({ width: 16, height: 16, mineCount: 40 }); // 표준 프리셋
  const runs = 200;
  let wins = 0;
  let totalActions = 0;

  for (let i = 0; i < runs; i++) {
    const result = playOneGame(1000 + i, params);
    if (result.phase === Phase.WON) wins += 1;
    totalActions += result.actionCount;
  }

  console.log(`[game-a sim] 무작위 에이전트 ${runs}판 (${params.width}x${params.height}, 지뢰 ${params.mineCount})`);
  console.log(`  클리어율: ${((wins / runs) * 100).toFixed(1)}%`);
  console.log(`  평균 행동 수: ${(totalActions / runs).toFixed(1)}`);
}

main();
