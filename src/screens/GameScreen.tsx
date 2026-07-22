import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Picture, PaintStyle, Skia, useFont } from '@shopify/react-native-skia';
import type { SkFont, SkPaint, SkPicture } from '@shopify/react-native-skia';
// 패키지 루트(barrel) 대신 특정 굵기 하위 경로에서 바로 import한다 — 루트로 가져오면
// Metro가 트리쉐이킹을 못 해 안 쓰는 다른 8개 굵기(각 6.2MB)까지 전부 번들에 들어간다.
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DIRECTION_DELTA, useKeyboardInput, type GameInputAction } from '../input';
import { GameBController, GamePhase, isAdjacent4, manhattanDistance, neighbors8, ORIGIN, vecKey } from '../engine';
import type { Vec2 } from '../engine';
import { BOARD_MARGIN, type CanvasLayout, computeFixedLayout, FOOTER_HEIGHT, offsetScreenPos, screenToOffset, VIEW_RADIUS_X, VIEW_RADIUS_Y } from './layout';

// 유일한 화면의 Skia 뷰. 상태·규칙은 src/engine(GameBController)에 있고, 이 파일은
// "Skia로 그리기"와 "제스처를 controller 호출로 번역하기"만 한다. 드래그 다중 선택은
// 없다 — 탭=이동, 롱프레스=해체 두 가지만 있으면 된다(§6.4의 마우스 좌/우클릭에 대응).
// A(지뢰추적자)에서 나온 드래그선택/코드오픈, 지뢰 이동 같은 기능은 src/mechanics에
// 재사용 가능한 형태로만 옮겨져 있고 아직 이 화면에 연결되지 않았다
// ([[decisions/2026-07-22-cherry-pick-a-into-b]] 참고).
//
// 폰트: 웹(CanvasKit)은 네이티브와 달리 기본 내장 폰트가 전혀 없어 Skia.Font(undefined, size)
// 로는 텍스트가 아예 안 그려진다 — 반드시 실제 폰트 파일을 useFont()로 로드해야 한다.
// 한글(HUD 문구, 버튼 라벨)을 그려야 하므로 Noto Sans KR을 번들(@expo-google-fonts
// /noto-sans-kr, MIT+OFL-1.1)해서 쓴다. useFont는 로드 전엔 null을 반환하므로, 폰트가
// 전부 준비되기 전까지는 캔버스를 그리지 않는다(아래 컴포넌트의 fontsReady 가드).

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

interface Fonts {
  meta: SkFont;
  cell: SkFont;
  button: SkFont;
  hint: SkFont;
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
  font: SkFont,
  onTap: () => void
): number {
  const paddingX = 14;
  const paddingY = 10;
  const textBounds = font.measureText(label);
  const width = textBounds.width + paddingX * 2;
  const height = 20 + paddingY * 2;

  const bg = Skia.RRectXY(Skia.XYWHRect(x, y, width, height), 6, 6);
  canvas.drawRRect(bg, fillPaint(COLOR.button));
  canvas.drawRRect(bg, strokePaint(COLOR.buttonBorder, 1));

  const origin = centeredTextOrigin(font, label, x + width / 2, y + height / 2);
  canvas.drawText(label, origin.x, origin.y, fillPaint(COLOR.text), font);

  regions.push({ x, y, width, height, onTap });
  return width;
}

function statusText(controller: GameBController): string {
  if (controller.phase === GamePhase.OVER) return `게임 종료 · 최종 점수 ${controller.game.score}`;
  return '정찰 중';
}

function buildScene(controller: GameBController, layout: CanvasLayout, fonts: Fonts): Scene {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight));
  const regions: TapRegion[] = [];
  const game = controller.game;
  const player = game.player;
  const gameOver = game.phase !== GamePhase.PLAYING;
  const cellSize = layout.cellSize;

  canvas.drawRect(Skia.XYWHRect(0, 0, layout.canvasWidth, layout.canvasHeight), fillPaint(COLOR.background));

  // HUD (게임 정보만 — 타이틀 텍스트는 웹 chrome 제거와 함께 없앴다)
  const dist = manhattanDistance(ORIGIN, player);
  const hearts = '♥'.repeat(Math.max(0, game.lives)) + '♡'.repeat(Math.max(0, game.params.lives - game.lives));
  const meta =
    `행동 ${game.actionsRemaining}/${game.params.actionBudget}  ·  라이프 ${hearts}  ·  ` +
    `점수 ${game.score}  ·  콤보 ${game.combo}  ·  거리 ${dist}  ·  시드 ${controller.seed}  ·  ${statusText(controller)}`;
  canvas.drawText(meta, BOARD_MARGIN, 24, fillPaint(COLOR.muted), fonts.meta);

  // 보드(플레이어 중심 뷰포트)
  const currentView = new Set<string>([vecKey(player), ...neighbors8(player).map(vecKey)]);

  for (let dy = -VIEW_RADIUS_Y; dy <= VIEW_RADIUS_Y; dy++) {
    for (let dx = -VIEW_RADIUS_X; dx <= VIEW_RADIUS_X; dx++) {
      const pos: Vec2 = { x: player.x + dx, y: player.y + dy };
      const { x: screenX, y: screenY } = offsetScreenPos(dx, dy, layout);

      const rec = game.observations.get(vecKey(pos));
      const isCurrent = currentView.has(vecKey(pos));
      const adjacent = isAdjacent4(player, pos);

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
        const origin = centeredTextOrigin(fonts.cell, label, screenX + cellSize / 2, screenY + cellSize / 2);
        canvas.drawText(label, origin.x, origin.y, fillPaint(labelColor), fonts.cell);
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
  const restartWidth = drawButton(canvas, regions, '재시작', BOARD_MARGIN, footerY, fonts.button, () => controller.restart());
  const hintX = BOARD_MARGIN + restartWidth + 16;
  canvas.drawText('탭: 이동선언 · 롱프레스: 해체선언 · 확정 칸은 후퇴', hintX, footerY + 26, fillPaint(COLOR.muted), fonts.hint);

  const picture = recorder.finishRecordingAsPicture();
  return { picture, regions };
}

export function GameScreen(): React.JSX.Element {
  // 캔버스 논리 해상도는 고정이다 — 화면(컨테이너) 크기만 onLayout으로 재서, 비율을
  // 유지한 채 그 크기에 맞는 스케일(scale)을 구한다("contain" 방식: 잘리거나 찌그러지지
  // 않고, 종횡비가 안 맞으면 한쪽에 여백이 남는다). 셀 크기·좌표 계산 등 게임 로직은
  // 이 스케일과 무관하게 항상 고정 해상도 기준으로만 돈다.
  const [measuredSize, setMeasuredSize] = useState({ width: 0, height: 0 });
  const onContainerLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== measuredSize.width || height !== measuredSize.height)) {
      setMeasuredSize({ width, height });
    }
  };

  const controllerRef = useRef<GameBController | null>(null);
  if (!controllerRef.current) controllerRef.current = new GameBController();
  const controller = controllerRef.current;

  useSyncExternalStore(
    (onChange) => controller.subscribe(onChange),
    () => controller.version
  );

  // useFont는 로드 완료 전엔 null을 반환한다 — 전부 준비될 때까지 캔버스를 그리지 않는다.
  const metaFont = useFont(NotoSansKR_400Regular, 12);
  const cellFont = useFont(NotoSansKR_400Regular, 13);
  const buttonFont = useFont(NotoSansKR_400Regular, 14);
  const hintFont = useFont(NotoSansKR_400Regular, 11);
  const fonts: Fonts | null =
    metaFont && cellFont && buttonFont && hintFont ? { meta: metaFont, cell: cellFont, button: buttonFont, hint: hintFont } : null;

  const layout = useMemo(() => computeFixedLayout(), []);
  const scale =
    measuredSize.width > 0 && measuredSize.height > 0
      ? Math.min(measuredSize.width / layout.canvasWidth, measuredSize.height / layout.canvasHeight)
      : 0;

  const scene = useMemo(() => {
    if (!fonts) return null;
    return buildScene(controller, layout, fonts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, layout, controller.version, fonts]);

  const findRegion = (regions: TapRegion[], x: number, y: number): TapRegion | undefined =>
    regions.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

  const targetAt = (x: number, y: number): Vec2 | null => {
    const offset = screenToOffset(x, y, layout);
    if (!offset) return null;
    return { x: controller.game.player.x + offset.dx, y: controller.game.player.y + offset.dy };
  };

  // ── 입력 레이어: 키보드(물리 키 → 추상 GameInputAction → controller 호출) ──────
  // "무슨 키 = 무슨 액션"은 src/input/keymap.ts의 defaultKeyBindings 한 곳에만 있다 —
  // 여기서는 그 결과인 추상 액션(방향+주/보조, 재시작)만 다룬다. 나중에 설정 화면이
  // 키맵을 바꿔도 이 콜백은 손댈 필요가 없다.
  const handleKeyboardAction = useCallback(
    (action: GameInputAction): void => {
      if (action.type === 'restart') {
        controller.restart();
        return;
      }
      const { dx, dy } = DIRECTION_DELTA[action.direction];
      const target: Vec2 = { x: controller.game.player.x + dx, y: controller.game.player.y + dy };
      if (action.kind === 'primary') controller.onPrimaryAction(target);
      else controller.onSecondaryAction(target);
    },
    [controller]
  );
  useKeyboardInput(handleKeyboardAction);

  // ── 입력 레이어(터치 제스처 → controller 호출) ──────────────────────────
  // 탭 = 주 동작(이동 선언), 롱프레스 = 보조 동작(해체 선언) — 마우스 좌/우클릭과 대응.
  // 제스처 좌표는 화면에 표시된(스케일된) 크기 기준이라, 캔버스 논리 좌표로 쓰려면
  // scale로 나눠서 되돌려야 한다(레터박스 스케일과 무관하게 항상 정확한 칸을 짚도록).
  const tapGesture = Gesture.Tap().onEnd((e) => {
    if (!scene || scale <= 0) return;
    const x = e.x / scale;
    const y = e.y / scale;
    const region = findRegion(scene.regions, x, y);
    if (region) {
      region.onTap();
      return;
    }
    const target = targetAt(x, y);
    if (target) controller.onPrimaryAction(target);
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(12)
    .onStart((e) => {
      if (scale <= 0) return;
      const target = targetAt(e.x / scale, e.y / scale);
      if (target) controller.onSecondaryAction(target);
    });

  const composedGesture = Gesture.Race(longPressGesture, tapGesture);

  const displayWidth = layout.canvasWidth * scale;
  const displayHeight = layout.canvasHeight * scale;

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {scene && scale > 0 && (
        <GestureDetector gesture={composedGesture}>
          <View style={{ width: displayWidth, height: displayHeight }}>
            <Canvas style={{ width: displayWidth, height: displayHeight }}>
              <Group transform={[{ scale }]}>
                <Picture picture={scene.picture} />
              </Group>
            </Canvas>
          </View>
        </GestureDetector>
      )}
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
