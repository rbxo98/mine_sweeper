import { Application, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import { createParams, createRng, EXPLOSION_LABEL, Game, GroundVisual, Phase } from '../object';
import type { Ground, Params, Vec2 } from '../object';

// 이 파일 밖에는 게임 UI가 없다 — 전체 게임(보드 + HUD + 버튼)을 캔버스 하나 안에서만 그린다.
// index.html/style.css는 그 캔버스를 화면 중앙에 배치하는 역할만 한다.
// §6의 정식 연출(스프라이트 애니메이션·파티클·카메라)은 이후 이 클래스 위에 얹는다 —
// 지금은 도형+텍스트로 규칙이 완전히 동작하는 수준(P2)까지만 맞춘다.

// §6.1 원안은 "셀 최소 44px"였지만, 스크롤 없이 도전 프리셋(30×16)까지 한 화면에 들어오도록
// 축소했다 — 숫자만 적당히 읽히면 되고 그 이상의 여백은 필요 없다는 판단 (2026-07-22).
const CELL_SIZE = 22;
const CELL_GAP = 2;
const BOARD_MARGIN = 16;
const HUD_HEIGHT = 64;
const FOOTER_HEIGHT = 56;

// 고전 지뢰찾기 표준 난이도 표(입문 9×9/10, 표준 16×16/40, 도전 30×16/99)를 그대로 따른다.
const PRESETS: Record<string, Params> = {
  입문: createParams({ width: 9, height: 9, mineCount: 10 }),
  표준: createParams({ width: 16, height: 16, mineCount: 40 }),
  도전: createParams({ width: 30, height: 16, mineCount: 99 }),
};

const COLOR = {
  background: 0x111318,
  hidden: 0x23262e,
  revealed: 0x113b3b,
  flagged: 0x3b2a11,
  explosion: 0x5c1a1a,
  selectedBorder: 0xffcc4d,
  text: 0xf2f2f2,
  muted: 0x9aa0ab,
  correct: 0x4caf50,
  incorrect: 0xe05353,
  button: 0x181a20,
  buttonBorder: 0x2a2d35,
  buttonDisabled: 0x14151a,
} as const;

function vecKeyOf(v: Vec2): string {
  return `${v.x},${v.y}`;
}

export class GameView {
  private readonly app: Application;
  private readonly root = new Container();

  private currentPresetName = '표준';
  private seed = 0;
  private game: Game;
  private selected = new Set<string>();
  /** 드래그 선택 중 적용할 동작 — 드래그 시작 칸의 상태로 정해진다 (null이면 드래그 중 아님) */
  private dragMode: 'select' | 'deselect' | null = null;

  constructor(app: Application) {
    this.app = app;
    this.app.stage.addChild(this.root);
    this.game = this.createGame(this.currentPresetName);
    // 드래그 중 캔버스 밖에서 마우스를 놓아도 드래그가 끝나도록 전역으로 듣는다.
    window.addEventListener('pointerup', () => {
      this.dragMode = null;
    });
  }

  start(): void {
    this.resizeToCurrentBoard();
    this.render();
  }

  private createGame(presetName: string): Game {
    this.seed = Math.floor(Math.random() * 1_000_000);
    return new Game(PRESETS[presetName]!, createRng(this.seed));
  }

  private restart(presetName: string = this.currentPresetName): void {
    this.currentPresetName = presetName;
    this.game = this.createGame(presetName);
    this.selected = new Set();
    this.dragMode = null;
    this.resizeToCurrentBoard();
    this.render();
  }

  /**
   * 캔버스 크기 = 보드 크기와 HUD 제목·하단 버튼 줄이 실제로 필요로 하는 폭 중 더 큰 쪽.
   * 입문처럼 작은 보드(9×9)는 보드 자체보다 HUD 제목이나 버튼 줄이 더 넓어서, 보드 크기만
   * 보고 캔버스를 잡으면 그 내용이 캔버스 밖으로 잘려나간다 — 실제로 만들어본 컨테이너의
   * 폭을 재서(폰트 렌더링에 의존하는 값이라 하드코딩 대신 실측) 최소 폭을 보장한다 (2026-07-22).
   */
  private resizeToCurrentBoard(): void {
    const { width: cols, height: rows } = this.game.params;
    const boardPxW = cols * CELL_SIZE + (cols - 1) * CELL_GAP;
    const boardPxH = rows * CELL_SIZE + (rows - 1) * CELL_GAP;
    const boardWidth = BOARD_MARGIN * 2 + boardPxW;
    const height = HUD_HEIGHT + BOARD_MARGIN + boardPxH + BOARD_MARGIN + FOOTER_HEIGHT;

    const { contentWidth: hudWidth } = this.buildHud();
    const { contentWidth: footerWidth } = this.buildFooter();
    const width = Math.max(boardWidth, hudWidth, footerWidth);

    this.app.renderer.resize(width, height);
  }

  /**
   * 미공개 칸 클릭(드래그 시작점): 그 칸이 이미 선택 중이었으면 이번 드래그는 "해제" 모드,
   * 아니었으면 "선택" 모드로 정하고 그 칸부터 바로 적용한다. 단순 클릭(드래그 없음)은
   * 이 칸 하나만 토글되는 것과 결과가 같다.
   */
  private beginDragSelect(cell: Ground): void {
    if (!cell.isHidden) return;
    const alreadySelected = this.selected.has(vecKeyOf(cell.position));
    this.dragMode = alreadySelected ? 'deselect' : 'select';
    this.applyDragMode(cell);
  }

  /** 드래그 중 새로 지나간 칸에 현재 드래그 모드(선택/해제)를 적용한다. */
  private applyDragMode(cell: Ground): void {
    if (this.dragMode === null || !cell.isHidden) return;
    const k = vecKeyOf(cell.position);
    if (this.dragMode === 'select') this.selected.add(k);
    else this.selected.delete(k);
    this.render();
  }

  /**
   * 이미 공개된 숫자 칸을 클릭했을 때의 코드 오픈(원본 지뢰찾기의 chording) —
   * 주변 8칸 중 깃발 수가 그 칸의 숫자 이상이면, 아직 미공개·미깃발인 나머지 이웃 칸들을
   * 전부 임시 선택에 "추가"한다(토글 아님 — 이미 선택된 칸을 다시 빼지 않는다).
   * 숫자가 0인 칸은 깃발이 하나도 없어도(0 ≥ 0) 항상 조건을 만족해 바로 동작한다.
   * 제거는 그 칸을 직접 클릭해야만 가능하다.
   */
  private chordSelect(cell: Ground): void {
    const number = cell.adjacentMineCount;

    const neighbors = this.game.board.neighbors8(cell.position).map((p) => this.game.board.cellAt(p));
    const flaggedCount = neighbors.filter((n) => n.visual === GroundVisual.FLAGGED).length;
    if (flaggedCount < number) return;

    let changed = false;
    for (const n of neighbors) {
      if (!n.isHidden) continue;
      const k = vecKeyOf(n.position);
      if (!this.selected.has(k)) {
        this.selected.add(k);
        changed = true;
      }
    }
    if (changed) this.render();
  }

  private confirmReveal(): void {
    if (this.selected.size === 0) return;
    const cells: Vec2[] = [...this.selected].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y! };
    });
    this.game.reveal(cells);
    this.selected = new Set();
    this.render();
  }

  /**
   * 우클릭: 미공개 칸엔 깃발 설치, 이미 깃발 꽂힌 칸엔 회수 (§5.7 확장).
   * 임시 선택 중이던 다른 칸들은 그대로 유지한다 — 깃발을 꽂는다고 선택이 사라지지 않는다.
   * 방금 깃발 대상이 된 칸 자신만 선택에서 제거한다(더 이상 유효한 공개 후보가 아니므로).
   */
  private toggleFlag(cell: Ground): void {
    if (!cell.isHidden && !cell.isFlagged) return;
    this.selected.delete(vecKeyOf(cell.position));
    this.game.flag(cell.position);
    this.render();
  }

  private statusText(): string {
    if (this.game.phase === Phase.WON) return '클리어!';
    if (this.game.phase === Phase.LOST) return '패배';
    return '플레이 중';
  }

  /** 매 상태 변화마다 stage를 통째로 다시 그린다 — 턴제 퍼즐이라 빈도가 낮아 문제없다. */
  private render(): void {
    this.root.removeChildren();
    this.root.addChild(this.buildBackground());
    this.root.addChild(this.buildHud().container);
    this.root.addChild(this.buildBoard());
    this.root.addChild(this.buildFooter().container);
  }

  private buildBackground(): Graphics {
    const { width, height } = this.app.screen;
    return new Graphics().rect(0, 0, width, height).fill(COLOR.background);
  }

  private buildHud(): { container: Container; contentWidth: number } {
    const container = new Container();

    const title = new Text({
      text: '이동 지뢰찾기 (A) — MineTracker',
      style: { fill: COLOR.text, fontSize: 18, fontWeight: '600', fontFamily: 'system-ui' },
    });
    title.position.set(BOARD_MARGIN, 12);
    container.addChild(title);

    const meta =
      `프리셋 ${this.currentPresetName}  ·  시드 ${this.seed}  ·  ` +
      `남은 깃발 ${this.game.flagsRemaining}  ·  행동 수 ${this.game.actionCount}  ·  ${this.statusText()}`;
    const metaText = new Text({
      text: meta,
      style: { fill: COLOR.muted, fontSize: 13, fontFamily: 'system-ui' },
    });
    metaText.position.set(BOARD_MARGIN, 38);
    container.addChild(metaText);

    const contentWidth = BOARD_MARGIN + Math.max(title.width, metaText.width);
    return { container, contentWidth };
  }

  private buildBoard(): Container {
    const container = new Container();
    const originY = HUD_HEIGHT + BOARD_MARGIN;

    // 게임 종료 시 전체 지뢰 위치 공개 (§5.8): 정답 깃발(✓)·오답 깃발(✗)·미포획 지뢰·
    // 폭발 지점을 결과 화면에서 전부 드러낸다. 진행 중에는 game.mines를 절대 참고하지 않는다.
    const gameOver = this.game.phase !== Phase.PLAYING;
    const minePositions = gameOver ? new Set(this.game.mines.map((m) => vecKeyOf(m.position))) : null;

    for (const cell of this.game.board.allCells()) {
      const x = BOARD_MARGIN + cell.x * (CELL_SIZE + CELL_GAP);
      const y = originY + cell.y * (CELL_SIZE + CELL_GAP);

      const isSelected = this.selected.has(vecKeyOf(cell.position));
      const isExplosion = cell.visual === GroundVisual.REVEALED && cell.bundleLabel === EXPLOSION_LABEL;
      const isMine = gameOver && minePositions!.has(vecKeyOf(cell.position));

      const bgColor = isExplosion
        ? COLOR.explosion
        : cell.visual === GroundVisual.REVEALED
          ? COLOR.revealed
          : cell.visual === GroundVisual.FLAGGED
            ? COLOR.flagged
            : COLOR.hidden;

      const bg = new Graphics().roundRect(0, 0, CELL_SIZE, CELL_SIZE, 3).fill(bgColor);
      if (isSelected) {
        bg.roundRect(1, 1, CELL_SIZE - 2, CELL_SIZE - 2, 2).stroke({ width: 1.5, color: COLOR.selectedBorder });
      }
      bg.position.set(x, y);

      if (!gameOver) {
        bg.eventMode = 'static';
        bg.cursor = cell.isHidden || cell.isFlagged ? 'pointer' : 'default';
        bg.on('pointerdown', (e: FederatedPointerEvent) => {
          if (e.button === 2) {
            this.toggleFlag(cell);
          } else if (cell.visual === GroundVisual.REVEALED) {
            this.chordSelect(cell);
          } else {
            this.beginDragSelect(cell);
          }
        });
        // 드래그로 지나간 미공개 칸에 현재 드래그 모드(선택/해제)를 적용한다.
        bg.on('pointerover', () => this.applyDragMode(cell));
      }
      container.addChild(bg);

      let label = '';
      if (isExplosion) {
        label = '💣';
      } else if (cell.visual === GroundVisual.REVEALED) {
        // 숫자 0은 굳이 표시하지 않는다 (2026-07-22) — 빈 칸으로 둔다.
        label = cell.adjacentMineCount === 0 ? '' : String(cell.adjacentMineCount);
      } else if (cell.visual === GroundVisual.FLAGGED) {
        label = gameOver ? (isMine ? '🚩✓' : '🚩✗') : '🚩';
      } else if (isMine) {
        label = '💣'; // 미포획 지뢰
      }

      if (label) {
        const labelColor = gameOver && cell.visual === GroundVisual.FLAGGED ? (isMine ? COLOR.correct : COLOR.incorrect) : COLOR.text;
        const text = new Text({ text: label, style: { fill: labelColor, fontSize: 12, fontFamily: 'system-ui' } });
        text.anchor.set(0.5);
        text.position.set(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        container.addChild(text);
      }
    }

    return container;
  }

  private buildFooter(): { container: Container; contentWidth: number } {
    const container = new Container();
    // resizeToCurrentBoard()가 폭 측정을 위해 미리 호출할 때는 app.screen이 아직 이번
    // 크기로 갱신되기 전이라 footerY가 부정확할 수 있지만, 그 호출에서는 contentWidth만
    // 쓰고 이 container는 버려지므로 문제 없다.
    const footerY = this.app.screen.height - FOOTER_HEIGHT + 8;
    let cursorX = BOARD_MARGIN;

    const revealEnabled = this.selected.size > 0;
    const revealButton = this.makeButton(
      `공개 (${this.selected.size}칸)`,
      revealEnabled,
      () => this.confirmReveal()
    );
    revealButton.position.set(cursorX, footerY);
    container.addChild(revealButton);
    cursorX += revealButton.width + 12;

    const restartButton = this.makeButton('재시작', true, () => this.restart());
    restartButton.position.set(cursorX, footerY);
    container.addChild(restartButton);
    cursorX += restartButton.width + 20;

    for (const name of Object.keys(PRESETS)) {
      const isActive = name === this.currentPresetName;
      const tab = this.makeButton(name, true, () => this.restart(name), isActive);
      tab.position.set(cursorX, footerY);
      container.addChild(tab);
      cursorX += tab.width + 8;
    }

    return { container, contentWidth: cursorX };
  }

  private makeButton(label: string, enabled: boolean, onClick: () => void, active = false): Container {
    const container = new Container();
    const text = new Text({
      text: label,
      style: { fill: enabled ? COLOR.text : COLOR.muted, fontSize: 14, fontFamily: 'system-ui' },
    });
    const paddingX = 14;
    const paddingY = 8;
    const width = text.width + paddingX * 2;
    const height = text.height + paddingY * 2;

    const bg = new Graphics()
      .roundRect(0, 0, width, height, 6)
      .fill(active ? COLOR.buttonBorder : enabled ? COLOR.button : COLOR.buttonDisabled)
      .stroke({ width: 1, color: COLOR.buttonBorder });
    text.position.set(paddingX, paddingY);

    container.addChild(bg, text);

    if (enabled) {
      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.on('pointerdown', () => onClick());
    }

    return container;
  }
}
