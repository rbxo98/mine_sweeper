import { isAdjacent4 } from './geometry';
import { CellStatus, Game, GamePhase } from './game';
import { createParams, type Params } from './params';
import { type Vec2, vecKey } from './Vec2';

/**
 * game-b의 "게임 이벤트 레이어" — game-a-core의 GameAController와 같은 패턴
 * ([[decisions/2026-07-22-shared-core-packages]], [[decisions/2026-07-22-input-vs-game-event-layer-split]]).
 * onPrimaryAction/onSecondaryAction만 받는다 — 마우스 우클릭인지 터치 롱프레스인지 전혀 모른다.
 */
export class GameBController {
  private _seed = 0;
  private _game: Game;
  private readonly listeners = new Set<() => void>();
  private _version = 0;
  /** 메인 화면에서 고른 설정(시야 반경, 맵 크기/행동력 등) — restart()에서도 그대로
   *  재사용해야 하므로 생성자에서 받아 저장해둔다. */
  private readonly paramOverrides: Partial<Params>;

  constructor(paramOverrides: Partial<Params> = {}) {
    this.paramOverrides = paramOverrides;
    this._game = this.createGame();
  }

  get game(): Game {
    return this._game;
  }

  get seed(): number {
    return this._seed;
  }

  get phase(): GamePhase {
    return this._game.phase;
  }

  /** 상태가 바뀔 때마다 1씩 늘어난다 — React `useSyncExternalStore` 스냅샷용. */
  get version(): number {
    return this._version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this._version += 1;
    for (const listener of this.listeners) listener();
  }

  private createGame(): Game {
    this._seed = Math.floor(Math.random() * 1_000_000);
    return new Game(createParams(this.paramOverrides), this._seed);
  }

  restart(): void {
    this._game = this.createGame();
    this.notify();
  }

  isConfirmedAt(pos: Vec2): boolean {
    const rec = this._game.observations.get(vecKey(pos));
    return rec !== undefined && rec.status !== CellStatus.OBSERVED;
  }

  // ── 게임 이벤트 레이어 (입력 장치 불문) ──────────────────────────────────

  /** 주 동작: 이동 선언(또는 확정 칸이면 후퇴). */
  onPrimaryAction(target: Vec2): void {
    this.act(target, false);
  }

  /** 보조 동작: 해체 선언(또는 확정 칸이면 후퇴). */
  onSecondaryAction(target: Vec2): void {
    this.act(target, true);
  }

  /** 인접 칸에 대한 이동/해체 선언, 또는 확정 칸으로의 후퇴 (§5.3, §6.4) */
  private act(target: Vec2, wantsDefuse: boolean): void {
    if (this._game.phase !== GamePhase.PLAYING) return;
    if (!isAdjacent4(this._game.player, target)) return;

    if (this.isConfirmedAt(target)) {
      this._game.retreat(target);
    } else if (wantsDefuse) {
      this._game.declareDefuse(target);
    } else {
      this._game.declareMove(target);
    }
    this.notify();
  }
}
