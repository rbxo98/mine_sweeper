import type { Vec2 } from './Vec2';

export const GroundVisual = {
  HIDDEN: 'hidden',
  REVEALED: 'revealed',
  FLAGGED: 'flagged',
} as const;

export type GroundVisual = (typeof GroundVisual)[keyof typeof GroundVisual];

/**
 * 보드 위 고정된 한 칸.
 *
 * 지뢰는 매 턴 이동하므로(§5.6) "이 칸이 지뢰칸인지"는 Ground 스스로 알지 않는다 —
 * 그건 Board가 Mine 목록과 대조해서 그때그때 판정한다. Ground 인스턴스는 게임 시작부터
 * 끝까지 같은 칸을 가리키는 고정 객체로 유지한다: 뷰 레이어(Pixi 등)가 칸마다 스프라이트를
 * 하나씩 붙여 재사용하려면 칸 자체의 정체성이 매 턴 바뀌면 안 되기 때문이다.
 */
export class Ground {
  readonly x: number;
  readonly y: number;

  visual: GroundVisual = GroundVisual.HIDDEN;
  /** 공개된 경우에만 의미 있음 — 주변 8칸의 현재 지뢰 수 (§5.4) */
  adjacentMineCount = 0;
  /** 속한 공개 묶음의 라벨. 공개되지 않았으면 null (§5.3, §6.2 시각 구분용) */
  bundleLabel: string | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get position(): Vec2 {
    return { x: this.x, y: this.y };
  }

  get isHidden(): boolean {
    return this.visual === GroundVisual.HIDDEN;
  }

  get isFlagged(): boolean {
    return this.visual === GroundVisual.FLAGGED;
  }

  reveal(bundleLabel: string): void {
    this.visual = GroundVisual.REVEALED;
    this.bundleLabel = bundleLabel;
  }

  flag(): void {
    this.visual = GroundVisual.FLAGGED;
  }

  /** 깃발 회수 — 다시 완전한 미공개 상태로 되돌린다 (§5.7 확장: 회수 허용) */
  unflag(): void {
    this.visual = GroundVisual.HIDDEN;
  }

  /** 묶음 폐쇄 시 완전한 미공개 상태로 되돌린다 (§5.3) */
  reset(): void {
    this.visual = GroundVisual.HIDDEN;
    this.bundleLabel = null;
    this.adjacentMineCount = 0;
  }
}
