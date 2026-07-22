/**
 * 범용 체인-오브-리스판서빌리티 러너 (§3 턴 시퀀스를 구현하기 위한 뼈대).
 *
 * 각 단계(PhaseHandler)는 자기 할 일만 수행한 뒤 continue/goto/stop 중 하나만 반환한다.
 * 어떤 단계도 다른 단계의 존재·이름·구현을 알거나 직접 호출하지 않는다 — 실제 실행 순서는
 * 호출부(runChain 호출자)가 넘기는 order 배열이 전담한다. 이 파일은 게임 도메인 타입을
 * 전혀 모르는 범용 유틸이라 Game/Board 등을 import하지 않는다.
 */
export type PhaseResult<PhaseName extends string> =
  | { type: 'continue' }
  | { type: 'goto'; phase: PhaseName }
  | { type: 'stop' };

export type PhaseHandler<PhaseName extends string, Ctx> = (ctx: Ctx) => PhaseResult<PhaseName>;

export function runChain<PhaseName extends string, Ctx>(
  order: readonly PhaseName[],
  phases: Record<PhaseName, PhaseHandler<PhaseName, Ctx>>,
  ctx: Ctx
): void {
  let i = 0;
  while (i < order.length) {
    const name = order[i]!;
    const result = phases[name](ctx);

    if (result.type === 'stop') return;

    if (result.type === 'goto') {
      const nextIndex = order.indexOf(result.phase);
      if (nextIndex === -1) {
        throw new Error(`runChain: '${result.phase}' 단계가 order 배열에 없습니다.`);
      }
      i = nextIndex;
      continue;
    }

    i += 1;
  }
}
