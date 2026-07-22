import { Application, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import { chebyshevDistance, GamePhase, GameBController, isAdjacent8, neighbors8, ORIGIN, vecKey } from 'game-b-core';
import type { Vec2 } from 'game-b-core';

// 이 파일 밖에는 게임 UI가 없다 — 전체 게임(지도 + HUD + 버튼)을 캔버스 하나 안에서만 그린다.
// index.html/style.css는 그 캔버스를 화면 중앙에 배치하는 역할만 한다.
// game-a와 동일한 방향([[decisions/2026-07-22-game-b-canvas-unification]])으로 통일했다.
// §6의 정식 연출(카메라 이징·스프라이트·파티클)은 이후 이 클래스 위에 얹는다 — 지금은
// 도형+텍스트로 규칙이 완전히 동작하는 수준(P2)까지만 맞춘다.
//
// 게임 상태·규칙은 전부 `GameBController`(game-b-core)에 있다. 이 클래스는 순수하게 "Pixi로
// 그리기"와 "Pixi 포인터/키보드 이벤트를 controller의 onPrimaryAction 등으로 번역하기"만
// 한다 — game-a와 같은 패턴([[decisions/2026-07-22-shared-core-packages]]).

const CELL_SIZE = 32;
const VIEW_RADIUS_X = 8; // 플레이어 좌우로 보이는 칸 수 → 가로 17칸
const VIEW_RADIUS_Y = 6; // 플레이어 상하로 보이는 칸 수 → 세로 13칸
const BOARD_MARGIN = 12;
const HUD_HEIGHT = 60;
const FOOTER_HEIGHT = 48;

const COLOR = {
  background: 0x0b0c10,
  fog: 0x08090b,
  observedPast: 0x1c1f26,
  observedPastText: 0x6b7280,
  currentView: 0x262a33,
  currentViewText: 0xf2f2f2,
  visitedSafe: 0x123b2e,
  defused: 0x0f3a52,
  crater: 0x3a1414,
  player: 0xffcc4d,
  text: 0xf2f2f2,
  muted: 0x9aa0ab,
  button: 0x181a20,
  buttonBorder: 0x2a2d35,
  buttonDisabled: 0x14151a,
} as const;

const DIRECTION_KEYS: Record<string, Vec2> = {
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  q: { x: -1, y: -1 },
  e: { x: 1, y: -1 },
  z: { x: -1, y: 1 },
  c: { x: 1, y: 1 },
};

export class GameView {
  private readonly app: Application;
  private readonly root = new Container();
  private readonly controller = new GameBController();
  private readonly onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e);

  constructor(app: Application) {
    this.app = app;
    this.app.stage.addChild(this.root);
    this.controller.subscribe(() => this.render());
  }

  start(): void {
    this.resizeCanvas();
    window.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  private resizeCanvas(): void {
    const cols = VIEW_RADIUS_X * 2 + 1;
    const rows = VIEW_RADIUS_Y * 2 + 1;
    const width = BOARD_MARGIN * 2 + cols * CELL_SIZE;
    const height = HUD_HEIGHT + BOARD_MARGIN + rows * CELL_SIZE + BOARD_MARGIN + FOOTER_HEIGHT;
    this.app.renderer.resize(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    if (key === 'r' && !e.shiftKey) {
      e.preventDefault();
      this.controller.restart();
      return;
    }

    const dir = DIRECTION_KEYS[key];
    if (!dir) return;

    e.preventDefault();
    const target: Vec2 = { x: this.controller.game.player.x + dir.x, y: this.controller.game.player.y + dir.y };
    if (e.shiftKey) this.controller.onSecondaryAction(target);
    else this.controller.onPrimaryAction(target);
  }

  private statusText(): string {
    if (this.controller.phase === GamePhase.OVER) return `게임 종료 · 최종 점수 ${this.controller.game.score}`;
    return '정찰 중';
  }

  /** 매 턴마다 stage를 통째로 다시 그린다 — 턴제 퍼즐이라 빈도가 낮아 문제없다. */
  private render(): void {
    this.root.removeChildren();
    this.root.addChild(this.buildBackground());
    this.root.addChild(this.buildHud());
    this.root.addChild(this.buildBoard());
    this.root.addChild(this.buildFooter());
  }

  private buildBackground(): Graphics {
    const { width, height } = this.app.screen;
    return new Graphics().rect(0, 0, width, height).fill(COLOR.background);
  }

  private buildHud(): Container {
    const container = new Container();
    const game = this.controller.game;

    const title = new Text({
      text: '지뢰밭 정찰대 (B) — Minefield Scout',
      style: { fill: COLOR.text, fontSize: 17, fontWeight: '600', fontFamily: 'system-ui' },
    });
    title.position.set(BOARD_MARGIN, 10);
    container.addChild(title);

    const dist = chebyshevDistance(ORIGIN, game.player);
    const hearts = '♥'.repeat(Math.max(0, game.lives)) + '♡'.repeat(Math.max(0, game.params.lives - game.lives));
    const meta =
      `행동 ${game.actionsRemaining}/${game.params.actionBudget}  ·  라이프 ${hearts}  ·  ` +
      `점수 ${game.score}  ·  콤보 ${game.combo}  ·  거리 ${dist}  ·  시드 ${this.controller.seed}  ·  ${this.statusText()}`;
    const metaText = new Text({
      text: meta,
      style: { fill: COLOR.muted, fontSize: 12, fontFamily: 'system-ui' },
    });
    metaText.position.set(BOARD_MARGIN, 34);
    container.addChild(metaText);

    return container;
  }

  private buildBoard(): Container {
    const container = new Container();
    const originY = HUD_HEIGHT + BOARD_MARGIN;
    const game = this.controller.game;
    const player = game.player;
    const gameOver = game.phase !== GamePhase.PLAYING;

    const currentView = new Set<string>([vecKey(player), ...neighbors8(player).map(vecKey)]);

    for (let dy = -VIEW_RADIUS_Y; dy <= VIEW_RADIUS_Y; dy++) {
      for (let dx = -VIEW_RADIUS_X; dx <= VIEW_RADIUS_X; dx++) {
        const pos: Vec2 = { x: player.x + dx, y: player.y + dy };
        const screenX = BOARD_MARGIN + (dx + VIEW_RADIUS_X) * CELL_SIZE;
        const screenY = originY + (dy + VIEW_RADIUS_Y) * CELL_SIZE;

        const rec = game.observations.get(vecKey(pos));
        const isCurrent = currentView.has(vecKey(pos));
        const adjacent = isAdjacent8(player, pos);

        let bgColor: number = COLOR.fog;
        let label = '';
        let labelColor: number = COLOR.text;

        if (rec) {
          switch (rec.status) {
            case 'observed':
              bgColor = isCurrent ? COLOR.currentView : COLOR.observedPast;
              labelColor = isCurrent ? COLOR.currentViewText : COLOR.observedPastText;
              label = rec.sensorValue === 0 ? '' : String(rec.sensorValue);
              break;
            case 'visited_safe':
              bgColor = COLOR.visitedSafe;
              label = rec.sensorValue === 0 ? '' : String(rec.sensorValue);
              break;
            case 'defused':
              bgColor = COLOR.defused;
              label = '✓';
              break;
            case 'crater':
              bgColor = COLOR.crater;
              label = '×';
              break;
          }

          // 게임 오버: 관측했던 범위 안에서 아직 남아 있는(미포획) 지뢰를 공개한다 (§6.3).
          if (gameOver && game.world.isMine(pos)) {
            label = '💣';
            labelColor = COLOR.text;
          }
        }

        const bg = new Graphics().rect(0, 0, CELL_SIZE, CELL_SIZE).fill(bgColor);
        if (adjacent && !gameOver) {
          bg.rect(0.5, 0.5, CELL_SIZE - 1, CELL_SIZE - 1).stroke({ width: 1, color: COLOR.buttonBorder });
        }
        bg.position.set(screenX, screenY);

        if (adjacent && !gameOver) {
          bg.eventMode = 'static';
          bg.cursor = 'pointer';
          // 입력 레이어: 우클릭=보조 동작이라는 매핑이 이 한 줄에만 있다.
          bg.on('pointerdown', (e: FederatedPointerEvent) => {
            if (e.button === 2) this.controller.onSecondaryAction(pos);
            else this.controller.onPrimaryAction(pos);
          });
        }
        container.addChild(bg);

        if (label) {
          const text = new Text({ text: label, style: { fill: labelColor, fontSize: 14, fontFamily: 'system-ui' } });
          text.anchor.set(0.5);
          text.position.set(screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2);
          container.addChild(text);
        }

        if (dx === 0 && dy === 0) {
          const marker = new Graphics().circle(0, 0, CELL_SIZE * 0.22).fill(COLOR.player);
          marker.position.set(screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2 - CELL_SIZE * 0.22);
          container.addChild(marker);
        }
      }
    }

    return container;
  }

  private buildFooter(): Container {
    const container = new Container();
    const footerY = this.app.screen.height - FOOTER_HEIGHT + 8;

    const restartButton = this.makeButton('재시작 (R)', true, () => this.controller.restart());
    restartButton.position.set(BOARD_MARGIN, footerY);
    container.addChild(restartButton);

    const hint = new Text({
      text: '좌클릭 이동선언 · 우클릭 해체선언 · 확정 칸은 후퇴 · WASD/방향키+QEZC 이동, Shift+방향 해체',
      style: { fill: COLOR.muted, fontSize: 11, fontFamily: 'system-ui' },
    });
    hint.position.set(BOARD_MARGIN + restartButton.width + 16, footerY + 6);
    container.addChild(hint);

    return container;
  }

  private makeButton(label: string, enabled: boolean, onClick: () => void): Container {
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
      .fill(enabled ? COLOR.button : COLOR.buttonDisabled)
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
