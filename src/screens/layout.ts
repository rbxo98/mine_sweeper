// Skia 뷰의 레이아웃 계산. 뷰포트가 플레이어 중심 고정 칸 수(가로 17×세로 13)이고,
// 캔버스 해상도 자체도 고정이다 — 기획 변경으로 창 폭에 따라 셀 크기를 다시 계산하는
// 반응형 방식은 버렸다. 화면에 맞추는 건 GameScreen.tsx가 이 고정 해상도를 비율
// 유지한 채로 스케일해서 담당한다(레터박스는 생기되 잘리거나 찌그러지지 않는다).

export const VIEW_RADIUS_X = 8;
export const VIEW_RADIUS_Y = 6;
export const CELL_SIZE = 32;
export const BOARD_MARGIN = 12;
export const HUD_HEIGHT = 40;
export const FOOTER_HEIGHT = 64;

export interface CanvasLayout {
  cellSize: number;
  canvasWidth: number;
  canvasHeight: number;
  originY: number;
}

export function computeFixedLayout(): CanvasLayout {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const cellSize = CELL_SIZE;

  const canvasWidth = BOARD_MARGIN * 2 + cols * cellSize;
  const originY = HUD_HEIGHT + BOARD_MARGIN;
  const canvasHeight = originY + rows * cellSize + BOARD_MARGIN + FOOTER_HEIGHT;

  return { cellSize, canvasWidth, canvasHeight, originY };
}

/** 화면 좌표(캔버스 논리 좌표계 기준) → (dx, dy)(플레이어 기준 상대 칸 오프셋). 보드 영역 밖이면 null. */
export function screenToOffset(x: number, y: number, layout: CanvasLayout): { dx: number; dy: number } | null {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const cx = Math.floor((x - BOARD_MARGIN) / layout.cellSize);
  const cy = Math.floor((y - layout.originY) / layout.cellSize);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  return { dx: cx - VIEW_RADIUS_X, dy: cy - VIEW_RADIUS_Y };
}

export function offsetScreenPos(dx: number, dy: number, layout: CanvasLayout): { x: number; y: number } {
  return {
    x: BOARD_MARGIN + (dx + VIEW_RADIUS_X) * layout.cellSize,
    y: layout.originY + (dy + VIEW_RADIUS_Y) * layout.cellSize,
  };
}
