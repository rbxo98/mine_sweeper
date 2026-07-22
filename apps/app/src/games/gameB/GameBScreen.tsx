import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, PaintStyle, Skia } from '@shopify/react-native-skia';
import type { SkFont, SkPaint, SkPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { chebyshevDistance, GameBController, GamePhase, isAdjacent8, neighbors8, ORIGIN, vecKey } from 'game-b-core';
import type { Vec2 } from 'game-b-core';
import { BOARD_MARGIN, type CanvasLayout, computeLayout, FOOTER_HEIGHT, offsetScreenPos, screenToOffset, VIEW_RADIUS_X, VIEW_RADIUS_Y } from './layout';

// game-b의 Skia 뷰 — game-a(GameAScreen.tsx)와 완전히 같은 패턴을 따른다: 상태·규칙은
// GameBController(game-b-core)에 있고, 이 파일은 "Skia로 그리기"와 "제스처를 controller
// 호출로 번역하기"만 한다. game-a와 달리 드래그 다중 선택이 없어 팬 제스처가 필요 없다 —
// 탭=이동, 롱프레스=해체 두 가지만 있으면 된다(§6.4의 마우스 좌/우클릭에 대응).

const COLOR = {
  background: '#0b0c10',
  fog: '#08090b',
  observedPast: '#1c1f26',
  observedPastText: '#6b7280',
  currentView: '#262a33',
  currentViewText: '#f2f2f2',
  visitedSafe: '#123b2e',
  defused: '#0f3a52',
  crater: '#3a1414',
  player: '#ffcc4d',
  text: '#f2f2f2',
  muted: '#9aa0ab',
  button: '#181a20',
  buttonBorder: '#2a2d35',
  buttonDisabled: '#14151a',
} as const;

const titleFont = Skia.Font(undefined, 17);
const metaFont = Skia.Font(undefined, 12);
const cellFont = Skia.Font(undefined, 13);
const buttonFont = Skia.Font(undefined, 14);
const hintFont = Skia.Font(undefined, 11);

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

function drawButton(
  canvas: import('@shopify/react-native-skia').SkCanvas,
  regions: TapRegion[],
  label: string,
  x: number,
  y: number,
  onTap: () => void
): number {
  const paddingX = 14;
  const paddingY = 10;
  const textBounds = buttonFont.measureText(label);
  const width = textBounds.width + paddingX * 2;
  const height = 20 + paddingY * 2;

  const bg = Skia.RRectXY(Skia.XYWHRect(x, y, width, height), 6, 6);
  canvas.drawRRect(bg, fillPaint(COLOR.button));
  canvas.drawRRect(bg, strokePaint(COLOR.buttonBorder, 1));

  const origin = centeredTextOrigin(buttonFont, label, x + width / 2, y + height / 2);
  canvas.drawText(label, origin.x, origin.y, fillPaint(COLOR.text), buttonFont);

  regions.push({ x, y, width, height, onTap });
  return width;
}

function statusText(controller: GameBController): string {
  if (controller.phase === GamePhase.OVER) return `게임 종료 · 최종 점수 ${controller.game.score}`;
  return '정찰 중';
}

function buildScene(controller: GameBController, layout: CanvasLayout): Scene {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight));
  const regions: TapRegion[] = [];
  const game = controller.game;
  const player = game.player;
  const gameOver = game.phase !== GamePhase.PLAYING;
  const cellSize = layout.cellSize;

  canvas.drawRect(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight), fillPaint(COLOR.background));

  // HUD
  canvas.drawText('지뢰밭 정찰대 (B) — Minefield Scout', BOARD_MARGIN, 24, fillPaint(COLOR.text), titleFont);
  const dist = chebyshevDistance(ORIGIN, player);
  const hearts = '♥'.repeat(Math.max(0, game.lives)) + '♡'.repeat(Math.max(0, game.params.lives - game.lives));
  const meta =
    `행동 ${game.actionsRemaining}/${game.params.actionBudget}  ·  라이프 ${hearts}  ·  ` +
    `점수 ${game.score}  ·  콤보 ${game.combo}  ·  거리 ${dist}  ·  시드 ${controller.seed}  ·  ${statusText(controller)}`;
  canvas.drawText(meta, BOARD_MARGIN, 46, fillPaint(COLOR.muted), metaFont);

  // 보드(플레이어 중심 뷰포트)
  const currentView = new Set<string>([vecKey(player), ...neighbors8(player).map(vecKey)]);

  for (let dy = -VIEW_RADIUS_Y; dy <= VIEW_RADIUS_Y; dy++) {
    for (let dx = -VIEW_RADIUS_X; dx <= VIEW_RADIUS_X; dx++) {
      const pos: Vec2 = { x: player.x + dx, y: player.y + dy };
      const { x: screenX, y: screenY } = offsetScreenPos(dx, dy, layout);

      const rec = game.observations.get(vecKey(pos));
      const isCurrent = currentView.has(vecKey(pos));
      const adjacent = isAdjacent8(player, pos);

      let bgColor: string = COLOR.fog;
      let label = '';
      let labelColor: string = COLOR.text;

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

        // 게임 오버: 관측했던 범위 안에서 아직 남아 있는(미포획) 지뢰를 공개 (§6.3).
        // 이모지 대신 텍스트만 쓴다(기본 Skia 폰트의 색 이모지 미지원 가능성, GameAScreen 상단 주석 참고).
        if (gameOver && game.world.isMine(pos)) {
          label = 'X';
          labelColor = COLOR.text;
        }
      }

      canvas.drawRect(Skia.XYWHRect(screenX, screenY, cellSize, cellSize), fillPaint(bgColor));
      if (adjacent && !gameOver) {
        canvas.drawRect(
          Skia.XYWHRect(screenX + 0.5, screenY + 0.5, cellSize - 1, cellSize - 1),
          strokePaint(COLOR.buttonBorder, 1)
        );
      }

      if (label) {
        const origin = centeredTextOrigin(cellFont, label, screenX + cellSize / 2, screenY + cellSize / 2);
        canvas.drawText(label, origin.x, origin.y, fillPaint(labelColor), cellFont);
      }

      if (dx === 0 && dy === 0) {
        canvas.drawCircle(
          screenX + cellSize / 2,
          screenY + cellSize / 2 - cellSize * 0.22,
          cellSize * 0.22,
          fillPaint(COLOR.player)
        );
      }
    }
  }

  // 푸터
  const footerY = layout.canvasHeight - FOOTER_HEIGHT + 10;
  const restartWidth = drawButton(canvas, regions, '재시작', BOARD_MARGIN, footerY, () => controller.restart());
  const hintX = BOARD_MARGIN + restartWidth + 16;
  canvas.drawText('탭: 이동선언 · 롱프레스: 해체선언 · 확정 칸은 후퇴', hintX, footerY + 26, fillPaint(COLOR.muted), hintFont);

  const picture = recorder.finishRecordingAsPicture();
  return { picture, regions };
}

const MIN_CANVAS_MARGIN = 16;

export function GameBScreen(): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();

  // game-a와 동일한 이유([[../gameA/GameAScreen.tsx]] 참고) — 셸 스테이지 박스 등 폭이
  // 제한된 컨테이너 안에 내장될 수 있으므로 window 전체 폭 대신 자기 자신의 실제
  // onLayout 폭을 기준으로 반응형 계산한다.
  const [measuredWidth, setMeasuredWidth] = useState(windowWidth);
  const onContainerLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
  };

  const controllerRef = useRef<GameBController | null>(null);
  if (!controllerRef.current) controllerRef.current = new GameBController();
  const controller = controllerRef.current;

  useSyncExternalStore(
    (onChange) => controller.subscribe(onChange),
    () => controller.version
  );

  const availableWidth = Math.min(measuredWidth - MIN_CANVAS_MARGIN * 2, 720);
  const layout = useMemo(() => computeLayout(availableWidth), [availableWidth]);

  const scene = useMemo(
    () => buildScene(controller, layout),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, layout, controller.version]
  );

  const findRegion = (regions: TapRegion[], x: number, y: number): TapRegion | undefined =>
    regions.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

  const targetAt = (x: number, y: number): Vec2 | null => {
    const offset = screenToOffset(x, y, layout);
    if (!offset) return null;
    return { x: controller.game.player.x + offset.dx, y: controller.game.player.y + offset.dy };
  };

  // ── 입력 레이어(터치 제스처 → controller 호출) ──────────────────────────
  // 탭 = 주 동작(이동 선언), 롱프레스 = 보조 동작(해체 선언) — 마우스 좌/우클릭과 대응.
  const tapGesture = Gesture.Tap().onEnd((e) => {
    const region = findRegion(scene.regions, e.x, e.y);
    if (region) {
      region.onTap();
      return;
    }
    const target = targetAt(e.x, e.y);
    if (target) controller.onPrimaryAction(target);
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(12)
    .onStart((e) => {
      const target = targetAt(e.x, e.y);
      if (target) controller.onSecondaryAction(target);
    });

  const composedGesture = Gesture.Race(longPressGesture, tapGesture);

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
