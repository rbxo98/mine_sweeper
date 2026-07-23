import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, PaintStyle, Skia, useFont } from '@shopify/react-native-skia';
import type { SkFont, SkPaint, SkPicture } from '@shopify/react-native-skia';
// 패키지 루트(barrel) 대신 특정 굵기 하위 경로에서 바로 import한다 — 루트로 가져오면
// Metro가 트리쉐이킹을 못 해 안 쓰는 다른 8개 굵기(각 6.2MB)까지 전부 번들에 들어간다.
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DIRECTION_DELTA, useKeyboardInput, type GameInputAction } from '../input';
import { GameBController, GamePhase, isAdjacent4, manhattanDistance, neighbors8, ORIGIN, vecKey } from '../engine';
import type { Vec2 } from '../engine';
import { type BoardLayout, computeBoardLayout, offsetScreenPos, screenToOffset, VIEW_RADIUS_X, VIEW_RADIUS_Y } from './layout';

// 유일한 화면. 판(보드)이 화면 전체를 채우고, HUD/버튼 같은 게임 UI는 그 위에 얹는
// 오버레이(일반 RN View/Text/Pressable)로 띄운다 — Skia 캔버스 자체는 오직 보드
// 칸만 그린다(배경, 칸 색, 칸 라벨, 플레이어 마커). 상태·규칙은 src/engine
// (GameBController)에 있고, 이 파일은 "Skia로 보드 그리기"와 "제스처를 controller
// 호출로 번역하기"만 한다. 탭=이동, 롱프레스=해체(§6.4의 마우스 좌/우클릭에 대응).
// A(지뢰추적자)에서 나온 드래그선택/코드오픈, 지뢰 이동 같은 기능은 src/mechanics에
// 재사용 가능한 형태로만 옮겨져 있고 아직 이 화면에 연결되지 않았다
// ([[decisions/2026-07-22-cherry-pick-a-into-b]] 참고).
//
// 폰트: 웹(CanvasKit)은 네이티브와 달리 기본 내장 폰트가 전혀 없어 Skia.Font(undefined, size)
// 로는 텍스트가 아예 안 그려진다 — 보드 칸 라벨(숫자/✓/×)도 반드시 실제 폰트 파일을
// useFont()로 로드해야 한다. HUD/버튼/힌트 텍스트는 이제 일반 RN Text라 이 문제와 무관
// (웹은 시스템 폰트로 한글이 바로 나온다) — Skia 폰트가 필요한 건 보드 칸 라벨뿐이다.

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
  overlayBg: 'rgba(11, 12, 16, 0.72)',
  button: '#181a20',
  buttonBorder: '#2a2d35',
} as const;

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

function statusText(controller: GameBController): string {
  if (controller.phase === GamePhase.OVER) return `게임 종료 · 최종 점수 ${controller.game.score}`;
  return '정찰 중';
}

function metaText(controller: GameBController): string {
  const game = controller.game;
  const dist = manhattanDistance(ORIGIN, game.player);
  const hearts = '♥'.repeat(Math.max(0, game.lives)) + '♡'.repeat(Math.max(0, game.params.lives - game.lives));
  return (
    `행동 ${game.actionsRemaining}/${game.params.actionBudget}  ·  라이프 ${hearts}  ·  ` +
    `점수 ${game.score}  ·  콤보 ${game.combo}  ·  거리 ${dist}  ·  시드 ${controller.seed}  ·  ${statusText(controller)}`
  );
}

/** 보드 칸만 그린다 — HUD/버튼은 GameScreen 컴포넌트가 RN 오버레이로 얹는다. */
function buildBoardPicture(controller: GameBController, layout: BoardLayout, cellFont: SkFont): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, layout.boardWidth + layout.originX * 2, layout.boardHeight + layout.originY * 2));
  const game = controller.game;
  const player = game.player;
  const gameOver = game.phase !== GamePhase.PLAYING;
  const cellSize = layout.cellSize;

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

  return recorder.finishRecordingAsPicture();
}

export function GameScreen(): React.JSX.Element {
  // 판(보드)이 화면 전체를 채운다 — HUD/버튼은 이 컨테이너 크기와 무관하게 그 위에
  // 오버레이로 얹으므로, 여기서 재는 크기는 전체 화면 크기 그대로 보드 레이아웃에
  // 쓰인다(예전처럼 여백을 미리 빼고 계산하지 않는다).
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

  const layout = useMemo(() => computeBoardLayout(measuredSize.width, measuredSize.height), [measuredSize]);

  // useFont는 로드 완료 전엔 null을 반환한다 — 전부 준비될 때까지 보드를 그리지 않는다.
  const cellFontSize = Math.max(10, Math.round(layout.cellSize * 0.4));
  const cellFont = useFont(NotoSansKR_400Regular, cellFontSize);

  const picture = useMemo(() => {
    if (!cellFont || measuredSize.width === 0) return null;
    return buildBoardPicture(controller, layout, cellFont);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, layout, controller.version, cellFont, measuredSize.width]);

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
  // 재시작 버튼은 이제 일반 RN Pressable이라 여기서 별도 히트테스트가 필요 없다.
  const tapGesture = Gesture.Tap().onEnd((e) => {
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
      {picture && (
        <GestureDetector gesture={composedGesture}>
          <View style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Picture picture={picture} />
            </Canvas>
          </View>
        </GestureDetector>
      )}

      {/* HUD 오버레이 — 보드 위에 얹힐 뿐 탭은 그대로 보드로 통과시킨다. */}
      <View style={styles.hudBar} pointerEvents="none">
        <Text style={styles.hudText}>{metaText(controller)}</Text>
      </View>

      {/* 하단 오버레이 — 재시작 버튼만 실제로 탭을 받고, 나머지 영역은 보드로 통과. */}
      <View style={styles.footerBar} pointerEvents="box-none">
        <Pressable style={styles.button} onPress={() => controller.restart()}>
          <Text style={styles.buttonLabel}>재시작</Text>
        </Pressable>
        <Text style={styles.hintText} pointerEvents="none">
          탭: 이동선언 · 롱프레스: 해체선언 · 확정 칸은 후퇴
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.background,
  },
  hudBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLOR.overlayBg,
  },
  hudText: {
    color: COLOR.muted,
    fontSize: 13,
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLOR.overlayBg,
  },
  button: {
    backgroundColor: COLOR.button,
    borderColor: COLOR.buttonBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonLabel: {
    color: COLOR.text,
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    color: COLOR.muted,
    fontSize: 12,
    flexShrink: 1,
  },
});
