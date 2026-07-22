import { Application, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import { EXPLOSION_LABEL, GameAController, GroundVisual, Phase, PRESET_NAMES } from 'game-a-core';

// 이 파일 밖에는 게임 UI가 없다 — 전체 게임(보드 + HUD + 버튼)을 캔버스 하나 안에서만 그린다.
// index.html/style.css는 그 캔버스를 화면 중앙에 배치하는 역할만 한다.
// §6의 정식 연출(스프라이트 애니메이션·파티클·카메라)은 이후 이 클래스 위에 얹는다 —
// 지금은 도형+텍스트로 규칙이 완전히 동작하는 수준(P2)까지만 맞춘다.
//
// 게임 상태·규칙(어느 칸을 선택할 수 있는지, 깃발/코드오픈 판정 등)은 전부 `GameAController`
// (game-a-core)에 있다. 이 클래스는 순수하게 "Pixi로 그리기"와 "Pixi 포인터 이벤트를
// controller의 onPrimaryAction 등으로 번역하기"만 한다 — RN/Skia 뷰가 나중에 생기면 이
// controller를 그대로 재사용하고 이 클래스에 해당하는 부분만 새로 만들면 된다
// ([[decisions/2026-07-22-input-vs-game-event-layer-split]]).

// §6.1 원안은 "셀 최소 44px"였지만, 스크롤 없이 도전 프리셋(30×16)까지 한 화면에 들어오도록
// 축소했다 — 숫자만 적당히 읽히면 되고 그 이상의 여백은 필요 없다는 판단 (2026-07-22).
const CELL_SIZE = 22;
const CELL_GAP = 2;
const BOARD_MARGIN = 16;
const HUD_HEIGHT = 64;
const FOOTER_HEIGHT = 56;

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

function vecKeyOf(v: { x: number; y: number }): string {
  return `${v.x},${v.y}`;
}

export class GameView {
  private readonly app: Application;
  private readonly root = new Container();
  private readonly controller = new GameAController('표준');

  constructor(app: Application) {
    this.app = app;
    this.app.stage.addChild(this.root);
    // controller 상태가 바뀔 때마다(공개/깃발/드래그선택/재시작) 다시 그린다.
    this.controller.subscribe(() => this.render());
    // 드래그 중 캔버스 밖에서 마우스를 놓아도 드래그가 끝나도록 전역으로 듣는다.
    window.addEventListener('pointerup', () => this.controller.onDragEnd());
  }

  start(): void {
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
    const { width: cols, height: rows } = this.controller.game.params;
    const boardPxW = cols * CELL_SIZE + (cols - 1) * CELL_GAP;
    const boardPxH = rows * CELL_SIZE + (rows - 1) * CELL_GAP;
    const boardWidth = BOARD_MARGIN * 2 + boardPxW;
    const height = HUD_HEIGHT + BOARD_MARGIN + boardPxH + BOARD_MARGIN + FOOTER_HEIGHT;

    const { contentWidth: hudWidth } = this.buildHud();
    const { contentWidth: footerWidth } = this.buildFooter();
    const width = Math.max(boardWidth, hudWidth, footerWidth);

    this.app.renderer.resize(width, height);
  }

  private statusText(): string {
    if (this.controller.phase === Phase.WON) return '클리어!';
    if (this.controller.phase === Phase.LOST) return '패배';
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

    const game = this.controller.game;
    const meta =
      `프리셋 ${this.controller.presetName}  ·  시드 ${this.controller.seed}  ·  ` +
      `남은 깃발 ${game.flagsRemaining}  ·  행동 수 ${game.actionCount}  ·  ${this.statusText()}`;
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
    const game = this.controller.game;

    // 게임 종료 시 전체 지뢰 위치 공개 (§5.8): 정답 깃발(✓)·오답 깃발(✗)·미포획 지뢰·
    // 폭발 지점을 결과 화면에서 전부 드러낸다. 진행 중에는 game.mines를 절대 참고하지 않는다.
    const gameOver = game.phase !== Phase.PLAYING;
    const minePositions = gameOver ? new Set(game.mines.map((m) => vecKeyOf(m.position))) : null;

    for (const cell of game.board.allCells()) {
      const x = BOARD_MARGIN + cell.x * (CELL_SIZE + CELL_GAP);
      const y = originY + cell.y * (CELL_SIZE + CELL_GAP);

      const isSelected = this.controller.selected.has(vecKeyOf(cell.position));
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
        // 입력 레이어: pixi 포인터 이벤트를 "주 동작/보조 동작/드래그 오버"로만 번역한다.
        // 우클릭=보조 동작이라는 매핑이 이 한 줄에만 있고, 실제 규칙은 controller가 갖는다.
        bg.on('pointerdown', (e: FederatedPointerEvent) => {
          if (e.button === 2) this.controller.onSecondaryAction(cell);
          else this.controller.onPrimaryAction(cell);
        });
        bg.on('pointerover', () => this.controller.onDragOver(cell));
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

    const revealEnabled = this.controller.selected.size > 0;
    const revealButton = this.makeButton(
      `공개 (${this.controller.selected.size}칸)`,
      revealEnabled,
      () => this.controller.confirmReveal()
    );
    revealButton.position.set(cursorX, footerY);
    container.addChild(revealButton);
    cursorX += revealButton.width + 12;

    const restartButton = this.makeButton('재시작', true, () => this.resizeAndRestart());
    restartButton.position.set(cursorX, footerY);
    container.addChild(restartButton);
    cursorX += restartButton.width + 20;

    for (const name of PRESET_NAMES) {
      const isActive = name === this.controller.presetName;
      const tab = this.makeButton(name, true, () => this.resizeAndRestart(name), isActive);
      tab.position.set(cursorX, footerY);
      container.addChild(tab);
      cursorX += tab.width + 8;
    }

    return { container, contentWidth: cursorX };
  }

  /**
   * 프리셋이 바뀌면 보드 크기도 바뀌므로 restart 후 캔버스 리사이즈까지 해준다.
   * controller.restart()가 곧바로 notify → render()를 한 번 트리거하지만 그건 아직
   * 리사이즈 전 캔버스 크기로 그려지므로, resizeToCurrentBoard() 다음에 render()를
   * 한 번 더 호출해 최종적으로 올바른 크기로 다시 그린다.
   */
  private resizeAndRestart(presetName?: (typeof PRESET_NAMES)[number]): void {
    this.controller.restart(presetName);
    this.resizeToCurrentBoard();
    this.render();
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
