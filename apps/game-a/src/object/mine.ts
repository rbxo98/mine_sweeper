import type { Vec2 } from './Vec2';

/**
 * 이동하는 지뢰 엔티티. 보드 칸(Ground)과 별개의 객체로 관리한다 — 지뢰는 매 턴 위치가
 * 바뀌지만(§5.6) Ground 인스턴스는 고정이어야 하므로, "칸을 지뢰로 바꿔치기"하는 대신
 * 지뢰 쪽이 자기 좌표를 옮겨 다니는 모델을 쓴다.
 */
export class Mine {
  x: number;
  y: number;
  /** 깃발로 고정되어 더 이상 이동하지 않는 상태. 플레이어에게 노출하지 않는다 (§5.7) */
  pinned = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get position(): Vec2 {
    return { x: this.x, y: this.y };
  }

  moveTo(pos: Vec2): void {
    this.x = pos.x;
    this.y = pos.y;
  }
}
