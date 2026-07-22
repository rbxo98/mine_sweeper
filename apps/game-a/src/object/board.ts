import { Ground, GroundVisual } from './ground';
import type { Mine } from './mine';
import { type Vec2, vecKey } from './Vec2';

/** 가로×세로 보드(정사각 아닐 수 있음 — 도전 프리셋은 30×16). Ground 인스턴스를 게임 시작 시 한 번만 만들어 계속 재사용한다. */
export class Board {
  readonly width: number;
  readonly height: number;
  /** [y][x], 고정 인스턴스 */
  readonly grid: Ground[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => new Ground(x, y))
    );
  }

  cellAt(pos: Vec2): Ground {
    return this.grid[pos.y]![pos.x]!;
  }

  inBounds(pos: Vec2): boolean {
    return pos.x >= 0 && pos.y >= 0 && pos.x < this.width && pos.y < this.height;
  }

  allCells(): Ground[] {
    return this.grid.flat();
  }

  /** 8방향 인접 칸 (숫자 계산용) */
  neighbors8(pos: Vec2): Vec2[] {
    const result: Vec2[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = { x: pos.x + dx, y: pos.y + dy };
        if (this.inBounds(n)) result.push(n);
      }
    }
    return result;
  }

  /** 상하좌우 인접 칸 (이동용, §5.6 — 대각선 이동 없음) */
  neighbors4(pos: Vec2): Vec2[] {
    const deltas: Vec2[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    return deltas.map((d) => ({ x: pos.x + d.x, y: pos.y + d.y })).filter((n) => this.inBounds(n));
  }

  /**
   * 공개 중인 모든 칸의 숫자를 현재 지뢰 위치 기준으로 재계산한다 (§5.4).
   * 값이 바뀐 칸 좌표 목록을 반환한다 (연출용).
   */
  recomputeNumbers(mines: readonly Mine[]): Vec2[] {
    const mineKeys = new Set(mines.map((m) => vecKey(m.position)));
    const changed: Vec2[] = [];

    for (const cell of this.allCells()) {
      if (cell.visual !== GroundVisual.REVEALED) continue;
      const count = this.neighbors8(cell.position).filter((n) => mineKeys.has(vecKey(n))).length;
      if (cell.adjacentMineCount !== count) {
        changed.push(cell.position);
      }
      cell.adjacentMineCount = count;
    }

    return changed;
  }
}
