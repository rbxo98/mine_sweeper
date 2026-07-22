// Skia 뷰의 레이아웃 계산. 뷰포트가 플레이어 중심 고정 칸 수(가로 17×세로 13)라 보드
// 자체 크기는 항상 같다 — 반응형으로 조절할 건 셀 크기뿐이다(터치 화면 폭에 맞춤).

export const VIEW_RADIUS_X = 8;
export const VIEW_RADIUS_Y = 6;
export const MIN_CELL_SIZE = 20;
export const MAX_CELL_SIZE = 40;
export const BOARD_MARGIN = 12;
export const HUD_HEIGHT = 72;
export const FOOTER_HEIGHT = 64;

export interface CanvasLayout {
  cellSize: number;
  canvasWidth: number;
  canvasHeight: number;
  originY: number;
}

export function computeLayout(availableWidth: number): CanvasLayout {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const rawCellSize = Math.floor((availableWidth - BOARD_MARGIN * 2) / cols);
  const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, rawCellSize));

  const canvasWidth = BOARD_MARGIN * 2 + cols * cellSize;
  const originY = HUD_HEIGHT + BOARD_MARGIN;
  const canvasHeight = originY + rows * cellSize + BOARD_MARGIN + FOOTER_HEIGHT;

  return { cellSize, canvasWidth, canvasHeight, originY };
}

/** 화면 좌표 → (dx, dy)(플레이어 기준 상대 칸 오프셋). 보드 영역 밖이면 null. */
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
