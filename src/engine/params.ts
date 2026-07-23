// §9 밸런스 파라미터 표. 초기값은 문서 확정값 그대로.
export interface Params {
  /** 행동 수 (§4, §9 actionBudget) */
  actionBudget: number;
  /** 라이프 (§9 lives) */
  lives: number;
  /** 청크 한 변 (§5.6, §9 chunkSize) */
  chunkSize: number;
  /** 청크 지뢰 밀도 최솟값 (§9 densityMin) */
  densityMin: number;
  /** 청크 지뢰 밀도 최댓값 (§9 densityMax) */
  densityMax: number;
  /** 시작 안전 지대 한 변 — 5면 원점 중심 5×5 (§5.1, §9 safeRadius) */
  safeRadius: number;
  /** 시야 반경 — 플레이어 기준 체비쇼프 반경 몇 칸까지 매 턴 관측(observe)되는지
   *  (§5.1 "3×3 시야"는 이 값이 1일 때의 결과). 센서값 계산(§5.2)과는 별개 — 그건
   *  항상 고정 3×3(`neighbors8`)이다. */
  visionRadius: number;
  /** 최초 방문 안전 칸 점수 (§5.4 scoreSafe) */
  scoreSafe: number;
  /** 지뢰 해체 점수 (§5.4 scoreDefuse) */
  scoreDefuse: number;
  /** 콤보 마일스톤 주기 (§5.4 comboStep) */
  comboStep: number;
  /** 콤보 마일스톤 보너스 (§5.4 comboBonus) */
  comboBonus: number;
  /** 종료 시 도달 거리 보너스 계수 (§5.4 distBonus) */
  distBonus: number;
  /** 종료 시 생존 보너스 계수 (§5.4 lifeBonus) */
  lifeBonus: number;
}

export function createParams(overrides: Partial<Params> = {}): Params {
  return {
    actionBudget: 80,
    lives: 3,
    chunkSize: 16,
    densityMin: 0.16,
    densityMax: 0.22,
    safeRadius: 5,
    visionRadius: 1,
    scoreSafe: 10,
    scoreDefuse: 30,
    comboStep: 5,
    comboBonus: 50,
    distBonus: 5,
    lifeBonus: 50,
    ...overrides,
  };
}
