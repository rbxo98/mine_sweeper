// A(지뢰추적자)에서 체리픽한, 엔진/좌표계 독립적인 재사용 가능 메커니즘 모음.
// 이 중 어떤 것도 아직 src/engine이나 src/screens에 실제로 연결(wiring)돼 있지 않다 —
// 지금은 추출까지만 완료한 상태다([[decisions/2026-07-22-cherry-pick-a-into-b]] 참고).
export * from './rng';
export * from './selection';
export * from './wander';
export * from './diagonalMovement';
