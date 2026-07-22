import type { Ground } from './ground';

/** 한 번의 공개 행동으로 함께 공개된 칸들의 묶음 (§5.3) */
export class Bundle {
  constructor(
    public readonly label: string,
    public readonly cells: readonly Ground[]
  ) {}

  /** 수명이 다한 묶음을 폐쇄한다 — 칸들을 완전한 미공개 상태로 되돌린다 */
  close(): void {
    for (const cell of this.cells) cell.reset();
  }
}
