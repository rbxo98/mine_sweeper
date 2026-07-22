// game-a Skia 뷰의 반응형 레이아웃 계산 — 순수 함수만 모아둔다(테스트하기 쉽고, 그리기/입력
// 코드와 분리해서 재사용 가능하게). 데스크톱(Pixi) 버전은 셀 크기를 고정 22px로 뒀지만,
// 모바일은 화면 폭이 기기마다 다르고 터치 타겟은 손가락 크기를 고려해야 하므로, 사용 가능한
// 폭에서 열 수만큼 나눠 셀 크기를 계산하고 [MIN_CELL_SIZE, MAX_CELL_SIZE] 범위로 고정한다
// (2026-07-22, RN/Skia 이식).

export const MIN_CELL_SIZE = 18;
export const MAX_CELL_SIZE = 40;
export const CELL_GAP = 2;
export const BOARD_MARGIN = 16;
export const HUD_HEIGHT = 72;
export const FOOTER_HEIGHT = 72;

export interface CanvasLayout {
  cellSize: number;
  boardWidth: number;
  boardHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  originY: number;
}

/** 사용 가능한 폭(availableWidth)에서 열 수(cols)만큼 나눠 셀 크기를 정하고, 그 결과로
 *  캔버스 전체 크기를 계산한다. */
export function computeLayout(cols: number, rows: number, availableWidth: number): CanvasLayout {
  const rawCellSize = Math.floor((availableWidth - BOARD_MARGIN * 2 - (cols - 1) * CELL_GAP) / cols);
  const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, rawCellSize));

  const boardWidth = cols * cellSize + (cols - 1) * CELL_GAP;
  const boardHeight = rows * cellSize + (rows - 1) * CELL_GAP;
  const canvasWidth = BOARD_MARGIN * 2 + boardWidth;
  const originY = HUD_HEIGHT + BOARD_MARGIN;
  const canvasHeight = originY + boardHeight + BOARD_MARGIN + FOOTER_HEIGHT;

  return { cellSize, boardWidth, boardHeight, canvasWidth, canvasHeight, originY };
}

/** 화면 좌표(캔버스 기준 x,y) → 보드 칸 좌표. 보드 영역 밖이면 null. */
export function screenToCell(
  x: number,
  y: number,
  layout: CanvasLayout,
  cols: number,
  rows: number
): { x: number; y: number } | null {
  const step = layout.cellSize + CELL_GAP;
  const cx = Math.floor((x - BOARD_MARGIN) / step);
  const cy = Math.floor((y - layout.originY) / step);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  return { x: cx, y: cy };
}

/** 한 칸의 화면 좌상단 좌표. */
export function cellScreenPos(cx: number, cy: number, layout: CanvasLayout): { x: number; y: number } {
  const step = layout.cellSize + CELL_GAP;
  return { x: BOARD_MARGIN + cx * step, y: layout.originY + cy * step };
}
