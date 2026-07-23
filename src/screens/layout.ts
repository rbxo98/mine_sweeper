// 보드(Skia 캔버스) 레이아웃 계산. 보드는 화면 전체를 채운다 — HUD/버튼 같은 UI는
// 더 이상 보드 안에 여백을 잡아먹지 않고, GameScreen.tsx가 그 위에 별도 오버레이
// (일반 RN View/Text/Pressable)로 띄운다. 그래서 여기서는 순수하게 "컨테이너 크기가
// 주어졌을 때 17×13 칸을 정사각형으로 최대한 크게, 가운데 정렬해서 채우는" 계산만 한다.

export const VIEW_RADIUS_X = 8;
export const VIEW_RADIUS_Y = 6;
export const MIN_CELL_SIZE = 20;
// 상한을 두지 않는다 — 화면을 꽉 채우는 게 목적이라, 큰 모니터에서 셀이 커지는 건
// 의도된 결과다(작은 상한을 두면 그만큼 화면에 빈 공간이 남는다).

export interface BoardLayout {
  cellSize: number;
  boardWidth: number;
  boardHeight: number;
  /** 보드가 컨테이너 안에서 시작하는 좌상단 좌표 — 종횡비가 안 맞아 남는 여백을 가운데로 몬다. */
  originX: number;
  originY: number;
}

export function computeBoardLayout(containerWidth: number, containerHeight: number): BoardLayout {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const rawCellSize = Math.min(containerWidth / cols, containerHeight / rows);
  const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(rawCellSize));
  const boardWidth = cols * cellSize;
  const boardHeight = rows * cellSize;

  return {
    cellSize,
    boardWidth,
    boardHeight,
    originX: (containerWidth - boardWidth) / 2,
    originY: (containerHeight - boardHeight) / 2,
  };
}

/** 화면 좌표 → (dx, dy)(플레이어 기준 상대 칸 오프셋). 보드 영역 밖이면 null. */
export function screenToOffset(x: number, y: number, layout: BoardLayout): { dx: number; dy: number } | null {
  const cols = VIEW_RADIUS_X * 2 + 1;
  const rows = VIEW_RADIUS_Y * 2 + 1;
  const cx = Math.floor((x - layout.originX) / layout.cellSize);
  const cy = Math.floor((y - layout.originY) / layout.cellSize);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  return { dx: cx - VIEW_RADIUS_X, dy: cy - VIEW_RADIUS_Y };
}

export function offsetScreenPos(dx: number, dy: number, layout: BoardLayout): { x: number; y: number } {
  return {
    x: layout.originX + (dx + VIEW_RADIUS_X) * layout.cellSize,
    y: layout.originY + (dy + VIEW_RADIUS_Y) * layout.cellSize,
  };
}
