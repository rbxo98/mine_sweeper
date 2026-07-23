// 보드(Skia 캔버스) 레이아웃 계산. 셀은 항상 고정 크기의 정사각형이다 — 화면 크기가
// 바뀌어도 칸 하나의 실제 크기·모양은 절대 변하지 않는다. 대신 화면이 커지거나
// 작아지면 "플레이어 주위로 몇 칸이 보이는가"(시야 반경)가 늘거나 줄어든다 — 망원경
// 배율이 아니라 창문 크기가 바뀌는 셈이다. 그 결과 보드 크기(cols*CELL_SIZE ×
// rows*CELL_SIZE)가 컨테이너 크기와 정확히 안 맞을 수 있고, 남는 자투리(한 칸
// 미만)는 레터박스 여백으로 남는다 — 이건 버그가 아니라 "칸 크기 고정"을 지키기 위해
// 받아들이는 트레이드오프다(2026-07-23 "화면 전체를 예외 없이 채운다" 결정을
// 뒤집음, 사용자 지시).

/** 칸 하나의 고정 픽셀 크기(정사각형). 이 값 자체를 바꾸면 전체 게임의 확대/축소
 *  배율이 바뀐다 — 화면 크기에 따라 달라지는 값이 아니다. */
export const CELL_SIZE = 56;

/** 화면이 아무리 작아도 최소한 플레이어 좌우/상하로 이만큼은 보이도록 보장한다. */
const MIN_VIEW_RADIUS = 2;

export interface BoardLayout {
  cellSize: number;
  viewRadiusX: number;
  viewRadiusY: number;
  boardWidth: number;
  boardHeight: number;
  /** 보드 박스를 컨테이너 안에서 가운데 정렬하기 위한 오프셋(레터박스 여백의 절반). */
  originX: number;
  originY: number;
}

function computeRadius(containerSize: number, cellSize: number): number {
  // cols = 2*radius+1 개가 containerSize 안에 들어가야 한다 -> radius <= (containerSize/cellSize - 1) / 2
  const raw = Math.floor((containerSize / cellSize - 1) / 2);
  return Math.max(MIN_VIEW_RADIUS, raw);
}

export function computeBoardLayout(containerWidth: number, containerHeight: number): BoardLayout {
  const cellSize = CELL_SIZE;
  const viewRadiusX = computeRadius(containerWidth, cellSize);
  const viewRadiusY = computeRadius(containerHeight, cellSize);
  const cols = viewRadiusX * 2 + 1;
  const rows = viewRadiusY * 2 + 1;
  const boardWidth = cols * cellSize;
  const boardHeight = rows * cellSize;

  return {
    cellSize,
    viewRadiusX,
    viewRadiusY,
    boardWidth,
    boardHeight,
    originX: (containerWidth - boardWidth) / 2,
    originY: (containerHeight - boardHeight) / 2,
  };
}

/**
 * 화면 좌표 → (dx, dy)(플레이어 기준 상대 칸 오프셋). 보드 영역 밖이면 null.
 * x, y는 보드 박스 기준 좌표(컨테이너 기준이 아님 — 호출 측이 originX/Y만큼 이미
 * 빼서 넘긴다는 전제).
 */
export function screenToOffset(x: number, y: number, layout: BoardLayout): { dx: number; dy: number } | null {
  const cols = layout.viewRadiusX * 2 + 1;
  const rows = layout.viewRadiusY * 2 + 1;
  const cx = Math.floor(x / layout.cellSize);
  const cy = Math.floor(y / layout.cellSize);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  return { dx: cx - layout.viewRadiusX, dy: cy - layout.viewRadiusY };
}

export function offsetScreenPos(dx: number, dy: number, layout: BoardLayout): { x: number; y: number } {
  return {
    x: (dx + layout.viewRadiusX) * layout.cellSize,
    y: (dy + layout.viewRadiusY) * layout.cellSize,
  };
}
