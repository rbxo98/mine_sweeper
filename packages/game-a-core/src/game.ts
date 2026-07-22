import { Board } from './board';
import { Bundle } from './bundle';
import { Ground } from './ground';
import { Mine } from './mine';
import { type RNG, shuffle, weightedPick, type WeightedOption } from './rng';
import { type PhaseHandler, runChain } from './turnChain';
import { type Vec2, vecEquals, vecKey } from './Vec2';

export const Phase = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

export interface Params {
  /** 보드 가로 칸 수 (§4, §9 width — 도전 프리셋처럼 정사각이 아닐 수 있다) */
  width: number;
  /** 보드 세로 칸 수 (§4, §9 height) */
  height: number;
  /** 지뢰 수 = 깃발 수 (§9 mineCount) */
  mineCount: number;
  /** 유지되는 공개 묶음 수, 기본 2 (§9 bundleLife) */
  bundleLife: number;
  /** 지뢰 제자리 가중치, 기본 1.0 (§9 stayBias) */
  stayBias: number;
}

export function createParams(overrides: Partial<Params> = {}): Params {
  return { width: 9, height: 9, mineCount: 10, bundleLife: 2, stayBias: 1.0, ...overrides };
}

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** 패배 시 폭발 지점 칸에 부여하는 라벨 (§5.8 결과 화면 표시용, 일반 공개 묶음 라벨과 구분) */
export const EXPLOSION_LABEL = 'EXPLOSION';

// --- 턴 체인 정의 (§3) ---------------------------------------------------
// 각 단계는 자기 몫만 처리하고 continue/goto/stop 신호만 반환한다. 실제 순서는
// REVEAL_ORDER/FLAG_ORDER가 정하며, 단계 함수끼리는 서로의 이름조차 참조하지 않는다.

type RevealPhaseName = 'countAction' | 'judge' | 'bundleLifecycle' | 'movePhase' | 'recomputeNumbers';
type FlagPhaseName = 'countAction' | 'judge' | 'endCheck' | 'movePhase' | 'recomputeNumbers';

interface RevealContext {
  readonly validCells: Ground[];
  readonly isFirstAction: boolean;
  hitMine: boolean;
  label: string | null;
}

interface FlagContext {
  readonly cell: Ground;
  readonly pos: Vec2;
  readonly isRetraction: boolean;
}

const REVEAL_ORDER: readonly RevealPhaseName[] = [
  'countAction',
  'judge',
  'bundleLifecycle',
  'movePhase',
  'recomputeNumbers',
];

const FLAG_ORDER: readonly FlagPhaseName[] = ['countAction', 'judge', 'endCheck', 'movePhase', 'recomputeNumbers'];

/**
 * 한 판의 상태와 턴 시퀀스를 담당하는 오케스트레이터 (§3, §5). DOM에 의존하지 않으므로
 * 브라우저 UI와 Node 헤드리스 시뮬레이터가 이 클래스를 그대로 공유한다 (§10.2, §11).
 * 난수는 생성자로 주입받는다 — 전역 Math.random 사용 금지, 재현성 보장.
 */
export class Game {
  readonly params: Params;
  readonly board: Board;
  readonly mines: Mine[];
  readonly bundles: Bundle[] = [];

  flagsRemaining: number;
  actionCount = 0;
  phase: Phase = Phase.PLAYING;
  firstActionDone = false;
  /** 직전 이동 페이즈에서 숫자가 바뀐 칸 (연출용, UI가 참고) */
  changedCells: Vec2[] = [];

  private readonly rng: RNG;
  private nextBundleLabelIndex = 0;

  constructor(params: Params, rng: RNG) {
    this.params = params;
    this.rng = rng;
    this.board = new Board(params.width, params.height);
    this.flagsRemaining = params.mineCount;
    this.mines = this.generateMinePositions([]).map((p) => new Mine(p.x, p.y));
  }

  /** 미공개 칸 일괄 공개 (§3 step1~3, §5.1~§5.5) */
  reveal(cellsInput: readonly Vec2[]): void {
    if (this.phase !== Phase.PLAYING) return;
    if (cellsInput.length === 0) return; // 선택 0칸은 턴을 소비하지 않음 (§5.2)

    const validCells = cellsInput.map((pos) => this.board.cellAt(pos)).filter((cell) => cell.isHidden);
    if (validCells.length === 0) return;

    const ctx: RevealContext = {
      validCells,
      isFirstAction: !this.firstActionDone,
      hitMine: false,
      label: null,
    };
    this.firstActionDone = true;

    runChain(REVEAL_ORDER, this.revealPhases, ctx);
  }

  /**
   * 깃발 설치 또는 회수 (§3, §5.7, §5.8).
   * §5.7 원안은 "깃발 회수 불가(MVP)"였으나 회수를 허용하도록 확장했다 — 이미 깃발이 꽂힌
   * 칸을 다시 호출하면 설치가 아니라 회수로 처리한다.
   */
  flag(pos: Vec2): void {
    if (this.phase !== Phase.PLAYING) return;

    const cell = this.board.cellAt(pos);
    const isRetraction = cell.isFlagged;

    if (!isRetraction) {
      if (!cell.isHidden) return;
      if (this.flagsRemaining <= 0) return;
      this.firstActionDone = true;
    }

    const ctx: FlagContext = { cell, pos, isRetraction };
    runChain(FLAG_ORDER, this.flagPhases, ctx);
  }

  // --- reveal 체인 단계 ---------------------------------------------------

  private readonly revealPhases: Record<RevealPhaseName, PhaseHandler<RevealPhaseName, RevealContext>> = {
    countAction: () => {
      this.actionCount += 1;
      return { type: 'continue' };
    },

    // 행동 판정 (§3 step2, §5.1): 첫 공개 안전 보장 재배치 + 지뢰 적중 여부만 판단하고
    // 칸을 그에 맞게 표시한다. 묶음 생성·이동 페이즈는 이 단계의 관심사가 아니다.
    judge: (ctx) => {
      let mineKeys = new Set(this.mines.map((m) => vecKey(m.position)));

      // 첫 공개 안전 보장 (§5.1)은 "가장 먼저 선택(클릭)한 칸" 한 곳에만 적용한다.
      const primaryCell = ctx.validCells[0]!;
      if (ctx.isFirstAction && mineKeys.has(vecKey(primaryCell.position))) {
        const newPositions = this.generateMinePositions([primaryCell.position]);
        this.mines.forEach((mine, i) => {
          mine.moveTo(newPositions[i]!);
          mine.pinned = false;
        });
        mineKeys = new Set(this.mines.map((m) => vecKey(m.position)));
      }

      ctx.hitMine = ctx.validCells.some((cell) => mineKeys.has(vecKey(cell.position)));

      if (ctx.hitMine) {
        this.phase = Phase.LOST;
        // 선택 칸 중 실제로 지뢰가 있는 칸만 폭발 지점으로 표시한다.
        for (const cell of ctx.validCells) {
          if (mineKeys.has(vecKey(cell.position))) cell.reveal(EXPLOSION_LABEL);
          else cell.reveal(this.nextLabel());
        }
        // 패배 시에도 §5.8 결과 판정을 위해 숫자 갱신은 필요하지만, 묶음 생성과 이동
        // 페이즈는 건너뛴다.
        return { type: 'goto', phase: 'recomputeNumbers' };
      }

      ctx.label = this.nextLabel();
      for (const cell of ctx.validCells) cell.reveal(ctx.label);
      return { type: 'continue' };
    },

    // 묶음 수명 처리 (§5.3): 새 묶음을 등록하고, bundleLife개를 넘으면 가장 오래된 묶음 폐쇄.
    bundleLifecycle: (ctx) => {
      this.bundles.push(new Bundle(ctx.label!, ctx.validCells));
      while (this.bundles.length > this.params.bundleLife) {
        this.bundles.shift()!.close();
      }
      return { type: 'continue' };
    },

    movePhase: () => {
      this.moveMines();
      return { type: 'continue' };
    },

    recomputeNumbers: () => {
      this.changedCells = this.board.recomputeNumbers(this.mines);
      return { type: 'continue' };
    },
  };

  // --- flag 체인 단계 ------------------------------------------------------

  private readonly flagPhases: Record<FlagPhaseName, PhaseHandler<FlagPhaseName, FlagContext>> = {
    countAction: () => {
      this.actionCount += 1;
      return { type: 'continue' };
    },

    // 행동 판정: 설치 또는 회수만 수행한다. 최종 판정은 endCheck의 몫이다.
    judge: (ctx) => {
      const mine = this.mines.find((m) => vecEquals(m.position, ctx.pos));

      if (ctx.isRetraction) {
        ctx.cell.unflag();
        this.flagsRemaining += 1;
        if (mine) mine.pinned = false;
      } else {
        ctx.cell.flag();
        this.flagsRemaining -= 1;
        if (mine) mine.pinned = true;
      }

      return { type: 'continue' };
    },

    // 종료 체크 (§3 step4, §5.8): 마지막 깃발 설치일 때만 즉시 최종 판정하고 체인을 끝낸다.
    // 회수는 깃발 수를 늘리기만 하므로 이 단계와 무관하다.
    endCheck: (ctx) => {
      if (!ctx.isRetraction && this.flagsRemaining === 0) {
        this.phase = this.mines.every((m) => m.pinned) ? Phase.WON : Phase.LOST;
        return { type: 'stop' };
      }
      return { type: 'continue' };
    },

    movePhase: () => {
      this.moveMines();
      return { type: 'continue' };
    },

    recomputeNumbers: () => {
      this.changedCells = this.board.recomputeNumbers(this.mines);
      return { type: 'continue' };
    },
  };

  /** 매 이동 페이즈: 비고정 지뢰를 무작위 순서로 순차 이동시킨다 (§5.6) */
  private moveMines(): void {
    const movable = shuffle(this.rng, this.mines.filter((m) => !m.pinned));
    const occupied = new Set(this.mines.map((m) => vecKey(m.position)));

    for (const mine of movable) {
      occupied.delete(vecKey(mine.position));

      const options: WeightedOption<Vec2>[] = [{ value: mine.position, weight: this.params.stayBias }];
      for (const n of this.board.neighbors4(mine.position)) {
        const blocked = !this.board.cellAt(n).isHidden || occupied.has(vecKey(n));
        if (!blocked) options.push({ value: n, weight: 1 });
      }

      const chosen = weightedPick(this.rng, options);
      mine.moveTo(chosen);
      occupied.add(vecKey(chosen));
    }
  }

  private generateMinePositions(exclude: readonly Vec2[]): Vec2[] {
    const excludeKeys = new Set(exclude.map(vecKey));
    const candidates = this.board
      .allCells()
      .map((c) => c.position)
      .filter((p) => !excludeKeys.has(vecKey(p)));
    if (candidates.length < this.params.mineCount) {
      throw new Error('generateMinePositions: 배치 가능한 칸보다 지뢰 수가 많습니다.');
    }
    return shuffle(this.rng, candidates).slice(0, this.params.mineCount);
  }

  private nextLabel(): string {
    const label = LABELS[this.nextBundleLabelIndex % LABELS.length]!;
    this.nextBundleLabelIndex += 1;
    return label;
  }
}
