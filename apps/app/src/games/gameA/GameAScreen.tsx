import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, PaintStyle, Skia } from '@shopify/react-native-skia';
import type { SkFont, SkPaint, SkPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { EXPLOSION_LABEL, GameAController, GroundVisual, Phase, PRESET_NAMES } from 'game-a-core';
import type { Ground, PresetName } from 'game-a-core';
import { BOARD_MARGIN, type CanvasLayout, cellScreenPos, computeLayout, FOOTER_HEIGHT, HUD_HEIGHT, screenToCell } from './layout';

// game-a의 Skia 뷰 — apps/game-a(Pixi)의 GameView.ts와 나란히 두고 비교하면 이해하기 쉽다.
// 게임 상태·규칙은 전부 GameAController(game-a-core)에 있고, 여기는 순수하게
// "Skia로 그리기"와 "제스처를 controller.onPrimaryAction 등으로 번역하기"만 한다
// ([[decisions/2026-07-22-input-vs-game-event-layer-split]],
// [[decisions/2026-07-22-shared-core-packages]]).
//
// Pixi와 달리 Skia는 도형 하나하나에 자체 히트테스트/이벤트가 없다 — 캔버스 전체를 감싸는
// GestureDetector 하나가 원시 터치 좌표만 주고, 그 좌표가 어느 칸/버튼에 해당하는지는
// 이 파일이 직접 계산한다(`screenToCell`, `regions` 히트박스 목록).
//
// 알려진 제약: 기본 Skia 폰트가 플랫폼(특히 웹/CanvasKit)에 따라 한글 글리프를 지원 안 할 수
// 있다 — 커스텀 한글 폰트 번들링은 후속 작업으로 남겨둔다(이 파일은 텍스트 내용 자체는
// 정확하게 그리는 로직까지만 책임진다).

const COLOR = {
  background: '#111318',
  hidden: '#23262e',
  revealed: '#113b3b',
  flagged: '#3b2a11',
  explosion: '#5c1a1a',
  selectedBorder: '#ffcc4d',
  text: '#f2f2f2',
  muted: '#9aa0ab',
  correct: '#4caf50',
  incorrect: '#e05353',
  button: '#181a20',
  buttonBorder: '#2a2d35',
  buttonDisabled: '#14151a',
} as const;

const titleFont = Skia.Font(undefined, 18);
const metaFont = Skia.Font(undefined, 13);
const cellFont = Skia.Font(undefined, 13);
const buttonFont = Skia.Font(undefined, 14);

function vecKeyOf(v: { x: number; y: number }): string {
  return `${v.x},${v.y}`;
}

function fillPaint(color: string): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  return paint;
}

function strokePaint(color: string, width: number): SkPaint {
  const paint = fillPaint(color);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  return paint;
}

/** 텍스트를 (cx, cy) 중심에 오도록 drawText용 기준선 좌표를 계산한다(Pixi의 anchor(0.5) 대응). */
function centeredTextOrigin(font: SkFont, text: string, cx: number, cy: number): { x: number; y: number } {
  const bounds = font.measureText(text);
  return { x: cx - bounds.width / 2 - bounds.x, y: cy - bounds.y - bounds.height / 2 };
}

interface TapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  onTap: () => void;
}

interface Scene {
  picture: SkPicture;
  regions: TapRegion[];
}

/** 버튼 하나를 그리고, 그 히트박스를 regions에 등록한다. cursorX를 반환해 다음 버튼이 이어 붙게 한다. */
function drawButton(
  canvas: import('@shopify/react-native-skia').SkCanvas,
  regions: TapRegion[],
  label: string,
  x: number,
  y: number,
  enabled: boolean,
  onTap: () => void,
  active = false
): number {
  const paddingX = 14;
  const paddingY = 10;
  const textBounds = buttonFont.measureText(label);
  const width = textBounds.width + paddingX * 2;
  const height = 20 + paddingY * 2;

  const bg = Skia.RRectXY(Skia.XYWHRect(x, y, width, height), 6, 6);
  canvas.drawRRect(bg, fillPaint(active ? COLOR.buttonBorder : enabled ? COLOR.button : COLOR.buttonDisabled));
  canvas.drawRRect(bg, strokePaint(COLOR.buttonBorder, 1));

  const textOrigin = centeredTextOrigin(buttonFont, label, x + width / 2, y + height / 2);
  canvas.drawText(label, textOrigin.x, textOrigin.y, fillPaint(enabled ? COLOR.text : COLOR.muted), buttonFont);

  if (enabled) {
    regions.push({ x, y, width, height, onTap });
  }
  return width;
}

function statusText(controller: GameAController): string {
  if (controller.phase === Phase.WON) return '클리어!';
  if (controller.phase === Phase.LOST) return '패배';
  return '플레이 중';
}

function buildScene(
  controller: GameAController,
  layout: CanvasLayout,
  onRestart: (preset?: PresetName) => void
): Scene {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight));
  const regions: TapRegion[] = [];
  const game = controller.game;

  // 배경
  canvas.drawRect(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight), fillPaint(COLOR.background));

  // HUD
  canvas.drawText('이동 지뢰찾기 (A) — MineTracker', BOARD_MARGIN, 26, fillPaint(COLOR.text), titleFont);
  const meta =
    `프리셋 ${controller.presetName}  ·  시드 ${controller.seed}  ·  ` +
    `남은 깃발 ${game.flagsRemaining}  ·  행동 수 ${game.actionCount}  ·  ${statusText(controller)}`;
  canvas.drawText(meta, BOARD_MARGIN, 50, fillPaint(COLOR.muted), metaFont);

  // 보드
  const gameOver = game.phase !== Phase.PLAYING;
  const minePositions = gameOver ? new Set(game.mines.map((m) => vecKeyOf(m.position))) : null;
  const cellSize = layout.cellSize;

  for (const cell of game.board.allCells()) {
    const { x, y } = cellScreenPos(cell.x, cell.y, layout);

    const isSelected = controller.selected.has(vecKeyOf(cell.position));
    const isExplosion = cell.visual === GroundVisual.REVEALED && cell.bundleLabel === EXPLOSION_LABEL;
    const isMine = gameOver && minePositions!.has(vecKeyOf(cell.position));

    const bgColor = isExplosion
      ? COLOR.explosion
      : cell.visual === GroundVisual.REVEALED
        ? COLOR.revealed
        : cell.visual === GroundVisual.FLAGGED
          ? COLOR.flagged
          : COLOR.hidden;

    const rrect = Skia.RRectXY(Skia.XYWHRect(x, y, cellSize, cellSize), 3, 3);
    canvas.drawRRect(rrect, fillPaint(bgColor));
    if (isSelected) {
      const innerRRect = Skia.RRectXY(Skia.XYWHRect(x + 1, y + 1, cellSize - 2, cellSize - 2), 2, 2);
      canvas.drawRRect(innerRRect, strokePaint(COLOR.selectedBorder, 1.5));
    }

    // 라벨: 지뢰=X, 깃발=F(정답/오답은 색으로 구분), 숫자(0은 생략). 이모지 대신 텍스트만
    // 쓴다 — 기본 Skia 폰트가 이모지 글리프를 보장하지 않기 때문(위 파일 상단 주석 참고).
    let label = '';
    let labelColor: string = COLOR.text;
    if (isExplosion) {
      label = 'X';
    } else if (cell.visual === GroundVisual.REVEALED) {
      label = cell.adjacentMineCount === 0 ? '' : String(cell.adjacentMineCount);
    } else if (cell.visual === GroundVisual.FLAGGED) {
      label = 'F';
      if (gameOver) labelColor = isMine ? COLOR.correct : COLOR.incorrect;
    } else if (isMine) {
      label = 'X';
    }

    if (label) {
      const origin = centeredTextOrigin(cellFont, label, x + cellSize / 2, y + cellSize / 2);
      canvas.drawText(label, origin.x, origin.y, fillPaint(labelColor), cellFont);
    }

    if (!gameOver) {
      const step = cellSize + 0; // 히트 테스트는 screenToCell이 별도로 계산하므로 여기선 필요 없음
      void step;
    }
  }

  // 푸터: 공개/재시작/프리셋 탭
  const footerY = layout.canvasHeight - FOOTER_HEIGHT + 10;
  let cursorX = BOARD_MARGIN;

  const revealEnabled = controller.selected.size > 0;
  cursorX +=
    drawButton(
      canvas,
      regions,
      `공개 (${controller.selected.size}칸)`,
      cursorX,
      footerY,
      revealEnabled,
      () => controller.confirmReveal(),
      false
    ) + 12;

  cursorX += drawButton(canvas, regions, '재시작', cursorX, footerY, true, () => onRestart(), false) + 20;

  for (const name of PRESET_NAMES) {
    const isActive = name === controller.presetName;
    cursorX += drawButton(canvas, regions, name, cursorX, footerY, true, () => onRestart(name), isActive) + 8;
  }

  const picture = recorder.finishRecordingAsPicture();
  return { picture, regions };
}

const MIN_CANVAS_MARGIN = 16;

export function GameAScreen(): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();

  // 이 화면은 독립 실행(전체 창)될 수도, task #14의 셸 스테이지 박스처럼 폭이 제한된
  // 컨테이너 안에 내장될 수도 있다 — 그래서 window 전체 폭이 아니라 자기 자신의 실제
  // 레이아웃 폭(onLayout)을 기준으로 반응형 계산한다. windowWidth는 첫 페인트 전 깜빡임을
  // 줄이기 위한 초기값일 뿐이다.
  const [measuredWidth, setMeasuredWidth] = useState(windowWidth);
  const onContainerLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
  };

  const controllerRef = useRef<GameAController | null>(null);
  if (!controllerRef.current) controllerRef.current = new GameAController('표준');
  const controller = controllerRef.current;

  // controller는 React state가 아닌 일반 클래스 인스턴스라, 그 변화를 리렌더로 이어주려면
  // useSyncExternalStore로 구독한다. selected(Set)는 참조를 그대로 mutate하므로 그 자체를
  // 스냅샷으로 쓰면 안 되고, 매 변경마다 증가하는 controller.version을 스냅샷으로 쓴다.
  useSyncExternalStore(
    (onChange) => controller.subscribe(onChange),
    () => controller.version
  );

  const availableWidth = Math.min(measuredWidth - MIN_CANVAS_MARGIN * 2, 720);
  const { width: cols, height: rows } = controller.game.params;
  const layout = useMemo(() => computeLayout(cols, rows, availableWidth), [cols, rows, availableWidth]);

  const dragLastCellKey = useRef<string | null>(null);

  const cellAtScreenPos = (x: number, y: number): Ground | null => {
    const pos = screenToCell(x, y, layout, cols, rows);
    if (!pos) return null;
    return controller.game.board.cellAt(pos);
  };

  const findRegion = (regions: TapRegion[], x: number, y: number): TapRegion | undefined =>
    regions.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

  const restart = (preset?: PresetName) => controller.restart(preset);

  const scene = useMemo(
    () => buildScene(controller, layout, restart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, layout, controller.version]
  );

  // ── 입력 레이어(터치 제스처 → controller 호출) ──────────────────────────
  // 탭 = 주 동작(짧게 눌렀다 뗌), 롱프레스 = 보조 동작(깃발), 팬(드래그) = 여러 칸 연속 선택.
  // 셋 다 같은 터치 시퀀스에 걸려 있으므로 Race로 묶어 하나만 활성화되게 한다.
  const tapGesture = Gesture.Tap().onEnd((e) => {
    const region = findRegion(scene.regions, e.x, e.y);
    if (region) {
      region.onTap();
      return;
    }
    const cell = cellAtScreenPos(e.x, e.y);
    if (!cell) return;
    controller.onPrimaryAction(cell);
    controller.onDragEnd();
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(12)
    .onStart((e) => {
      const cell = cellAtScreenPos(e.x, e.y);
      if (!cell) return;
      controller.onSecondaryAction(cell);
    });

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      const cell = cellAtScreenPos(e.x, e.y);
      dragLastCellKey.current = cell ? vecKeyOf(cell.position) : null;
      if (cell) controller.onPrimaryAction(cell);
    })
    .onUpdate((e) => {
      const cell = cellAtScreenPos(e.x, e.y);
      if (!cell) return;
      const key = vecKeyOf(cell.position);
      if (key === dragLastCellKey.current) return;
      dragLastCellKey.current = key;
      controller.onDragOver(cell);
    })
    .onFinalize(() => {
      dragLastCellKey.current = null;
      controller.onDragEnd();
    });

  const composedGesture = Gesture.Race(longPressGesture, panGesture, tapGesture);

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      <GestureDetector gesture={composedGesture}>
        <View style={{ width: layout.canvasWidth, height: layout.canvasHeight }}>
          <Canvas style={{ width: layout.canvasWidth, height: layout.canvasHeight }}>
            <Picture picture={scene.picture} />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.background,
  },
});
