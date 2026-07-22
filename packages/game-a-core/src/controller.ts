import { createParams, Game, Phase, type Params } from './game';
import { type Ground, GroundVisual } from './ground';
import { createRng } from './rng';
import { type Vec2, vecKey } from './Vec2';

// 고전 지뢰찾기 표준 난이도 표(입문 9×9/10, 표준 16×16/40, 도전 30×16/99)를 그대로 따른다.
// 렌더러(Pixi/Skia)가 아니라 여기(도메인/컨트롤러 레이어)에 있어야 어떤 렌더러를 쓰든
// 같은 프리셋 목록을 그대로 재사용할 수 있다.
export const PRESET_NAMES = ['입문', '표준', '도전'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export const PRESETS: Record<PresetName, Params> = {
  입문: createParams({ width: 9, height: 9, mineCount: 10 }),
  표준: createParams({ width: 16, height: 16, mineCount: 40 }),
  도전: createParams({ width: 30, height: 16, mineCount: 99 }),
};

export type DragMode = 'select' | 'deselect' | null;

/**
 * game-a의 "게임 이벤트 레이어" ([[decisions/2026-07-22-input-vs-game-event-layer-split]]의
 * 후속 — 이제 이 레이어 자체를 렌더러(Pixi/Skia)와 완전히 분리된 클래스로 뽑아냈다).
 *
 * onPrimaryAction/onSecondaryAction/onDragOver/onDragEnd 네 메서드만 받는다 — 마우스 우클릭인지
 * 터치 롱프레스인지, Pixi인지 Skia인지 이 클래스는 전혀 모른다. 렌더러는 자신의 입력 이벤트를
 * 이 네 메서드 호출로 번역하고, `game`/`selected`/`dragMode` 상태를 읽어 그리기만 하면 된다.
 * 상태가 바뀔 때마다 `subscribe`로 등록한 리스너를 불러 재렌더를 트리거한다.
 */
export class GameAController {
  private _presetName: PresetName;
  private _seed = 0;
  private _game: Game;
  private _selected = new Set<string>();
  private _dragMode: DragMode = null;
  private readonly listeners = new Set<() => void>();

  constructor(presetName: PresetName = '표준') {
    this._presetName = presetName;
    this._game = this.createGame(presetName);
  }

  get game(): Game {
    return this._game;
  }

  get selected(): ReadonlySet<string> {
    return this._selected;
  }

  get dragMode(): DragMode {
    return this._dragMode;
  }

  get presetName(): PresetName {
    return this._presetName;
  }

  get seed(): number {
    return this._seed;
  }

  get phase(): Phase {
    return this._game.phase;
  }

  private _version = 0;

  /**
   * 상태가 바뀔 때마다 1씩 늘어나는 값. `selected`(Set)는 내부적으로 mutate-in-place
   * 방식이라 참조가 안 바뀌므로, React의 `useSyncExternalStore`처럼 참조 비교로 재렌더
   * 여부를 판단하는 곳에서는 `selected`가 아니라 이 값을 스냅샷으로 써야 한다.
   */
  get version(): number {
    return this._version;
  }

  /** 상태가 바뀔 때마다 호출되는 리스너를 등록한다. 반환값을 호출하면 등록이 해제된다. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this._version += 1;
    for (const listener of this.listeners) listener();
  }

  private createGame(presetName: PresetName): Game {
    this._seed = Math.floor(Math.random() * 1_000_000);
    return new Game(PRESETS[presetName], createRng(this._seed));
  }

  restart(presetName: PresetName = this._presetName): void {
    this._presetName = presetName;
    this._game = this.createGame(presetName);
    this._selected = new Set();
    this._dragMode = null;
    this.notify();
  }

  // ── 게임 이벤트 레이어 (입력 장치 불문) ──────────────────────────────────

  /** 주 동작(좌클릭/탭): 공개된 숫자 칸이면 코드 오픈, 아니면 드래그 선택 시작. */
  onPrimaryAction(cell: Ground): void {
    if (cell.visual === GroundVisual.REVEALED) this.chordSelect(cell);
    else this.beginDragSelect(cell);
  }

  /** 보조 동작(우클릭/롱프레스): 깃발 설치·회수. */
  onSecondaryAction(cell: Ground): void {
    this.toggleFlag(cell);
  }

  /** 드래그/스와이프 중 새 칸 위로 들어옴. */
  onDragOver(cell: Ground): void {
    this.applyDragMode(cell);
  }

  /** 드래그/스와이프 종료. */
  onDragEnd(): void {
    this._dragMode = null;
  }

  confirmReveal(): void {
    if (this._selected.size === 0) return;
    const cells: Vec2[] = [...this._selected].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y! };
    });
    this._game.reveal(cells);
    this._selected = new Set();
    this.notify();
  }

  /**
   * 미공개 칸 클릭(드래그 시작점): 그 칸이 이미 선택 중이었으면 이번 드래그는 "해제" 모드,
   * 아니었으면 "선택" 모드로 정하고 그 칸부터 바로 적용한다.
   */
  private beginDragSelect(cell: Ground): void {
    if (!cell.isHidden) return;
    const alreadySelected = this._selected.has(vecKey(cell.position));
    this._dragMode = alreadySelected ? 'deselect' : 'select';
    this.applyDragMode(cell);
  }

  private applyDragMode(cell: Ground): void {
    if (this._dragMode === null || !cell.isHidden) return;
    const k = vecKey(cell.position);
    if (this._dragMode === 'select') this._selected.add(k);
    else this._selected.delete(k);
    this.notify();
  }

  /**
   * 코드 오픈(chording): 주변 8칸 중 깃발 수가 그 칸의 숫자 이상이면, 아직 미공개·미깃발인
   * 나머지 이웃 칸들을 전부 임시 선택에 추가한다(토글 아님). 숫자 0인 칸은 항상 조건을
   * 만족한다(깃발 0개 ≥ 0).
   */
  private chordSelect(cell: Ground): void {
    const number = cell.adjacentMineCount;
    const neighbors = this._game.board.neighbors8(cell.position).map((p) => this._game.board.cellAt(p));
    const flaggedCount = neighbors.filter((n) => n.visual === GroundVisual.FLAGGED).length;
    if (flaggedCount < number) return;

    let changed = false;
    for (const n of neighbors) {
      if (!n.isHidden) continue;
      const k = vecKey(n.position);
      if (!this._selected.has(k)) {
        this._selected.add(k);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  /** 임시 선택 중이던 다른 칸들은 그대로 유지하고, 방금 깃발 대상이 된 칸만 선택에서 제거한다. */
  private toggleFlag(cell: Ground): void {
    if (!cell.isHidden && !cell.isFlagged) return;
    this._selected.delete(vecKey(cell.position));
    this._game.flag(cell.position);
    this.notify();
  }
}
