import { chebyshevDistance, isAdjacent8, neighbors8, ORIGIN } from './geometry';
import { type Params } from './params';
import { type PhaseHandler, runChain } from './turnChain';
import { type Vec2, vecKey } from './Vec2';
import { World } from './world';

export const CellStatus = {
  /** 관측만 됨(센서값 기록) — 아직 미확정 */
  OBSERVED: 'observed',
  /** 방문한 안전 칸 (정상 이동 성공 또는 헛손질 진입) */
  VISITED_SAFE: 'visited_safe',
  /** 해체 완료 칸 */
  DEFUSED: 'defused',
  /** 폭발 크레이터 */
  CRATER: 'crater',
} as const;

export type CellStatus = (typeof CellStatus)[keyof typeof CellStatus];

function isConfirmed(status: CellStatus): boolean {
  return status !== CellStatus.OBSERVED;
}

export const GamePhase = {
  PLAYING: 'playing',
  OVER: 'over',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface CellObservation {
  sensorValue: number;
  status: CellStatus;
}

// --- 턴 체인 정의 (§3) ---------------------------------------------------
// countAction(행동 수 소비) → judge(판정, §5.3) → enter(진입) → observe(관측 갱신) →
// endCheck(종료 체크). 각 단계는 자기 몫만 처리하고 continue/stop 신호만 반환한다 —
// game-a와 같은 신호 기반 체인-오브-리스판서빌리티 구조([[decisions/2026-07-22-game-a-turn-chain-refactor]]).

type ActionKind = 'move' | 'defuse' | 'retreat';
type TurnPhaseName = 'countAction' | 'judge' | 'enter' | 'observe' | 'endCheck';

interface TurnContext {
  readonly kind: ActionKind;
  readonly target: Vec2;
}

const TURN_ORDER: readonly TurnPhaseName[] = ['countAction', 'judge', 'enter', 'observe', 'endCheck'];

/**
 * 한 판의 상태와 턴 시퀀스를 담당하는 오케스트레이터 (§3, §5). DOM에 의존하지 않으므로
 * Node 헤드리스 시뮬레이터가 그대로 재사용한다 (§10.2, §11).
 * 지뢰는 고정(MVP, §4)이라 턴 진행 자체에는 난수가 필요 없다 — 난수는 오직 World의
 * 청크 생성(맵 레이아웃)에만 쓰인다.
 */
export class Game {
  readonly params: Params;
  readonly world: World;
  readonly observations = new Map<string, CellObservation>();

  player: Vec2 = ORIGIN;
  actionsRemaining: number;
  lives: number;
  score = 0;
  combo = 0;
  maxCombo = 0;
  maxDistance = 0;
  phase: GamePhase = GamePhase.PLAYING;

  visitCount = 0;
  defuseCount = 0;
  explosionCount = 0;
  fumbleCount = 0;
  retreatCount = 0;

  constructor(params: Params, worldSeed: number) {
    this.params = params;
    this.world = new World(params, worldSeed);
    this.actionsRemaining = params.actionBudget;
    this.lives = params.lives;

    // §5.1: 시작 칸은 안전 지대 안이라 항상 안전 — 이미 서 있는 칸이므로 방문 확정 처리.
    this.observations.set(vecKey(this.player), {
      sensorValue: this.world.sensorValueAt(this.player),
      status: CellStatus.VISITED_SAFE,
    });
    // §5.1: 시작 시 3×3 시야가 즉시 관측된다.
    for (const n of neighbors8(this.player)) this.recordObservation(n);
  }

  /** 인접 미확정 칸에 "안전" 선언 (§5.3, §6.4 좌클릭) */
  declareMove(target: Vec2): void {
    this.startTurn('move', target, { requireConfirmedTarget: false });
  }

  /** 인접 미확정 칸에 "지뢰" 선언 (§5.3, §6.4 우클릭) */
  declareDefuse(target: Vec2): void {
    this.startTurn('defuse', target, { requireConfirmedTarget: false });
  }

  /** 인접 확정 칸으로 무판정 이동 (§5.3, §5.8) */
  retreat(target: Vec2): void {
    this.startTurn('retreat', target, { requireConfirmedTarget: true });
  }

  private startTurn(kind: ActionKind, target: Vec2, opts: { requireConfirmedTarget: boolean }): void {
    if (this.phase !== GamePhase.PLAYING) return;
    if (!isAdjacent8(this.player, target)) return;

    const existing = this.observations.get(vecKey(target));
    const confirmed = existing !== undefined && isConfirmed(existing.status);

    // 이동/해체 선언은 미확정 칸에만, 후퇴는 확정 칸에만 가능 (§5.2, §5.8).
    if (confirmed !== opts.requireConfirmedTarget) return;

    runChain(TURN_ORDER, this.phases, { kind, target });
  }

  private readonly phases: Record<TurnPhaseName, PhaseHandler<TurnPhaseName, TurnContext>> = {
    countAction: () => {
      this.actionsRemaining -= 1;
      return { type: 'continue' };
    },

    // 행동 판정 (§3 step2, §5.3): 선언의 정오만 가리고 칸 상태·점수·라이프·콤보를 갱신한다.
    // 대상 칸으로 이동시키는 것은 이 단계의 일이 아니다 — 그건 enter의 몫이다.
    judge: (ctx) => {
      if (ctx.kind === 'retreat') {
        this.retreatCount += 1;
        return { type: 'continue' };
      }

      const actualMine = this.world.isMine(ctx.target);

      if (ctx.kind === 'move') {
        if (!actualMine) {
          this.score += this.params.scoreSafe;
          this.visitCount += 1;
          this.registerSuccess();
          this.confirm(ctx.target, CellStatus.VISITED_SAFE);
        } else {
          this.registerFailure();
          this.explosionCount += 1;
          this.world.removeMineAt(ctx.target);
          this.confirm(ctx.target, CellStatus.CRATER);
        }
      } else {
        // defuse
        if (actualMine) {
          this.score += this.params.scoreDefuse;
          this.defuseCount += 1;
          this.registerSuccess();
          this.world.removeMineAt(ctx.target);
          this.confirm(ctx.target, CellStatus.DEFUSED);
        } else {
          this.registerFailure();
          this.fumbleCount += 1;
          this.confirm(ctx.target, CellStatus.VISITED_SAFE);
        }
      }

      return { type: 'continue' };
    },

    // 진입 (§3 step3): 네 경우 모두 플레이어는 대상 칸으로 이동한다.
    enter: (ctx) => {
      this.player = ctx.target;
      const dist = chebyshevDistance(ORIGIN, this.player);
      if (dist > this.maxDistance) this.maxDistance = dist;
      return { type: 'continue' };
    },

    // 관측 갱신 (§3 step4): 새 위치 기준 3×3 센서값을 지도에 기록한다.
    observe: () => {
      this.recordObservation(this.player);
      for (const n of neighbors8(this.player)) this.recordObservation(n);
      return { type: 'continue' };
    },

    // 종료 체크 (§3 step5, §5.5): 행동 수 또는 라이프가 바닥나면 종료 보너스를 더하고 끝낸다.
    endCheck: () => {
      if (this.actionsRemaining <= 0 || this.lives <= 0) {
        this.phase = GamePhase.OVER;
        this.score += this.maxDistance * this.params.distBonus + this.lives * this.params.lifeBonus;
        return { type: 'stop' };
      }
      return { type: 'continue' };
    },
  };

  private registerSuccess(): void {
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo % this.params.comboStep === 0) this.score += this.params.comboBonus;
  }

  private registerFailure(): void {
    this.lives -= 1;
    this.combo = 0;
  }

  private confirm(pos: Vec2, status: CellStatus): void {
    this.observations.set(vecKey(pos), { sensorValue: this.world.sensorValueAt(pos), status });
  }

  private recordObservation(pos: Vec2): void {
    const key = vecKey(pos);
    const sensor = this.world.sensorValueAt(pos);
    const existing = this.observations.get(key);
    if (existing && isConfirmed(existing.status)) {
      existing.sensorValue = sensor; // 확정 상태는 유지하고 센서값만 최신화
    } else {
      this.observations.set(key, { sensorValue: sensor, status: CellStatus.OBSERVED });
    }
  }
}
