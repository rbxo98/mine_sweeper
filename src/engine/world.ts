import { neighbors8 } from './geometry';
import type { Params } from './params';
import { createRng, hashSeed, shuffle } from './rng';
import { type Vec2, vecKey } from './Vec2';

function chunkIndexOf(coord: number, size: number): number {
  return Math.floor(coord / size);
}

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * 무한 절차 생성 지뢰밭 (§5.6, §10.2). 실제 지뢰 배치("정답")만 담당하고, 플레이어가
 * 무엇을 관측·확정했는지는 전혀 모른다 — 그건 Game이 별도 레이어(관측 맵)로 관리한다
 * (§10.2 "맵은 청크 딕셔너리로 저장, 관측값은 별도 레이어").
 *
 * 청크는 필요할 때 지연 생성해 캐시한다. 청크 시드는 (worldSeed, cx, cy)에서 결정적으로
 * 파생되므로 같은 시드는 탐사 순서와 무관하게 항상 같은 지뢰밭을 만든다 (§10.3).
 */
export class World {
  private readonly chunkSize: number;
  private readonly densityMin: number;
  private readonly densityMax: number;
  private readonly safeHalfExtent: number;
  private readonly worldSeed: number;
  /** null이면 무한 맵. 양수면 원점 중심 [-mapHalfExtent, mapHalfExtent] 정사각형 밖은
   *  전부 맵 밖(지뢰도 없고 이동 대상도 될 수 없음) — 유한 맵 모드(§ 메인 화면 설정). */
  private readonly mapHalfExtent: number | null;

  private readonly chunkMines = new Map<string, ReadonlySet<string>>();
  /** 해체·폭발로 실제 제거된 지뢰. 청크의 원본 배치는 그대로 두고 이 목록으로 덮어쓴다. */
  private readonly removedMines = new Set<string>();

  constructor(params: Params, worldSeed: number) {
    this.chunkSize = params.chunkSize;
    this.densityMin = params.densityMin;
    this.densityMax = params.densityMax;
    this.safeHalfExtent = Math.floor(params.safeRadius / 2);
    this.mapHalfExtent = params.mapSize > 0 ? Math.floor(params.mapSize / 2) : null;
    this.worldSeed = worldSeed;
  }

  /** 유한 맵일 때 맵 경계 안인지. 무한 맵이면 항상 true. */
  isInBounds(pos: Vec2): boolean {
    if (this.mapHalfExtent === null) return true;
    return Math.abs(pos.x) <= this.mapHalfExtent && Math.abs(pos.y) <= this.mapHalfExtent;
  }

  isMine(pos: Vec2): boolean {
    if (!this.isInBounds(pos)) return false;
    const key = vecKey(pos);
    if (this.removedMines.has(key)) return false;
    return this.ensureChunk(pos).has(key);
  }

  /** 해체 성공 또는 폭발로 지뢰가 소멸했을 때 호출 (§5.3) */
  removeMineAt(pos: Vec2): void {
    this.removedMines.add(vecKey(pos));
  }

  /** 센서값 = 주변 8칸의 지뢰 수. 그 칸 자체의 지뢰 여부와는 무관하다 (§5.2). */
  sensorValueAt(pos: Vec2): number {
    let count = 0;
    for (const n of neighbors8(pos)) {
      if (this.isMine(n)) count += 1;
    }
    return count;
  }

  private ensureChunk(pos: Vec2): ReadonlySet<string> {
    const cx = chunkIndexOf(pos.x, this.chunkSize);
    const cy = chunkIndexOf(pos.y, this.chunkSize);
    const key = chunkKey(cx, cy);

    let mines = this.chunkMines.get(key);
    if (!mines) {
      mines = this.generateChunk(cx, cy);
      this.chunkMines.set(key, mines);
    }
    return mines;
  }

  private generateChunk(cx: number, cy: number): ReadonlySet<string> {
    const seed = hashSeed(this.worldSeed, cx, cy);
    const rng = createRng(seed);

    const density = this.densityMin + rng() * (this.densityMax - this.densityMin);
    const cellTotal = this.chunkSize * this.chunkSize;
    const mineCount = Math.round(cellTotal * density);

    const originX = cx * this.chunkSize;
    const originY = cy * this.chunkSize;
    const candidates: Vec2[] = [];

    for (let dy = 0; dy < this.chunkSize; dy++) {
      for (let dx = 0; dx < this.chunkSize; dx++) {
        const pos: Vec2 = { x: originX + dx, y: originY + dy };
        if (!this.isInSafeZone(pos)) candidates.push(pos);
      }
    }

    const chosen = shuffle(rng, candidates).slice(0, Math.min(mineCount, candidates.length));
    return new Set(chosen.map(vecKey));
  }

  private isInSafeZone(pos: Vec2): boolean {
    return Math.abs(pos.x) <= this.safeHalfExtent && Math.abs(pos.y) <= this.safeHalfExtent;
  }
}
