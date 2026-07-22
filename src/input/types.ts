// 입력 계층의 어휘(vocabulary) — 물리 장치(키보드, 게임패드 등)와 게임 로직 사이에 있는
// 추상 액션. 어떤 물리 키가 이 액션에 매핑되는지는 여기서 전혀 모른다(그건 keymap.ts의
// 몫) — 나중에 사용자가 키 설정을 바꿔도 이 타입/게임 쪽 소비 코드는 손댈 필요가 없다.

export type Direction = 'up' | 'down' | 'left' | 'right';

/** '주 동작'(이동 선언) 인지 '보조 동작'(해체 선언) 인지 — GameBController의
 * onPrimaryAction/onSecondaryAction과 대응(§6.4 마우스 좌/우클릭, 터치 탭/롱프레스와
 * 동일한 두 갈래). */
export type ActionKind = 'primary' | 'secondary';

export type GameInputAction =
  | { type: 'directional'; direction: Direction; kind: ActionKind }
  | { type: 'restart' };

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
