// 보드(Skia 캔버스) 레이아웃 계산. 보드는 화면 전체를 예외 없이 채운다 — 종횡비가
// 안 맞아 생기는 여백(레터박스) 자체를 만들지 않는다. 셀을 정사각형으로 유지하려고
// 하면 17:13 격자 비율과 실제 화면 비율이 다를 때 반드시 한쪽에 여백이 남는데, 그건
// "화면 전체를 채운다"는 요구와 정면으로 모순된다 — 그래서 셀 가로/세로 크기를 따로
// 계산해서 보드 크기가 항상 정확히 컨테이너 크기와 같도록 만든다(cellWidth ≠
// cellHeight일 수 있음, 정사각형이 아닐 수 있지만 여백은 절대 생기지 않는다).

export const VIEW_RADIUS_X = 8;
export const VIEW_RADIUS_Y = 6;

export interface BoardLayout {
  cellWidth: number;
  cellHeight: number;
  boardWidth: number;
  boardHeight: number;
}

export function computeBoardLayout(containerWidth: number, containerHeight: number): BoardLayout {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const cellWidth = containerWidth / cols;
  const cellHeight = containerHeight / rows;

  return {
    cellWidth,
    cellHeight,
    // 보드 크기는 항상 컨테이너 크기와 정확히 같다 — origin도 0으로 고정(여백 없음).
    boardWidth: containerWidth,
    boardHeight: containerHeight,
  };
}

/** 화면 좌표 → (dx, dy)(플레이어 기준 상대 칸 오프셋). 보드 영역 밖이면 null. */
export function screenToOffset(x: number, y: number, layout: BoardLayout): { dx: number; dy: number } | null {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const cx = Math.floor(x / layout.cellWidth);
  const cy = Math.floor(y / layout.cellHeight);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  return { dx: cx - VIEW_RADIUS_X, dy: cy - VIEW_RADIUS_Y };
}

export function offsetScreenPos(dx: number, dy: number, layout: BoardLayout): { x: number; y: number } {
  return {
    x: (dx + VIEW_RADIUS_X) * layout.cellWidth,
    y: (dy + VIEW_RADIUS_Y) * layout.cellHeight,
  };
}
