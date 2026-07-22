import type { GameInputAction } from './types';

/**
 * 물리 키 조합 문자열 -> 추상 게임 입력 액션. 조합 문자열은 KeyboardInputSource가
 * KeyboardEvent에서 정규화해 만든다(예: "Shift+ArrowUp", "w") — 이 파일은 그 문자열이
 * 실제로 어떻게 만들어지는지 모르는, 순수한 매핑 테이블/조회 로직만 담당한다.
 */
export interface KeyBinding {
  key: string;
  action: GameInputAction;
}

/**
 * 기본 키맵 — 방향키/WASD는 주 동작(이동), Shift+방향키/WASD는 보조 동작(해체),
 * R은 재시작. 이 배열이 유일한 정의처다: 다른 어디에서도 "무슨 키 = 무슨 액션"을
 * 하드코딩하지 않는다. 나중에 설정 화면이 생기면 이 배열 대신 사용자가 고른
 * KeyBinding[]을 KeymapStore.setBindings()로 갈아끼우면 된다.
 */
export const defaultKeyBindings: KeyBinding[] = [
  { key: 'ArrowUp', action: { type: 'directional', direction: 'up', kind: 'primary' } },
  { key: 'ArrowDown', action: { type: 'directional', direction: 'down', kind: 'primary' } },
  { key: 'ArrowLeft', action: { type: 'directional', direction: 'left', kind: 'primary' } },
  { key: 'ArrowRight', action: { type: 'directional', direction: 'right', kind: 'primary' } },
  { key: 'w', action: { type: 'directional', direction: 'up', kind: 'primary' } },
  { key: 's', action: { type: 'directional', direction: 'down', kind: 'primary' } },
  { key: 'a', action: { type: 'directional', direction: 'left', kind: 'primary' } },
  { key: 'd', action: { type: 'directional', direction: 'right', kind: 'primary' } },

  { key: 'Shift+ArrowUp', action: { type: 'directional', direction: 'up', kind: 'secondary' } },
  { key: 'Shift+ArrowDown', action: { type: 'directional', direction: 'down', kind: 'secondary' } },
  { key: 'Shift+ArrowLeft', action: { type: 'directional', direction: 'left', kind: 'secondary' } },
  { key: 'Shift+ArrowRight', action: { type: 'directional', direction: 'right', kind: 'secondary' } },
  { key: 'Shift+w', action: { type: 'directional', direction: 'up', kind: 'secondary' } },
  { key: 'Shift+s', action: { type: 'directional', direction: 'down', kind: 'secondary' } },
  { key: 'Shift+a', action: { type: 'directional', direction: 'left', kind: 'secondary' } },
  { key: 'Shift+d', action: { type: 'directional', direction: 'right', kind: 'secondary' } },

  { key: 'r', action: { type: 'restart' } },
];

/** 조합 문자열로 바인딩을 찾는다. 없으면 null(그 키는 그냥 무시). */
export function resolveAction(comboKey: string, bindings: readonly KeyBinding[]): GameInputAction | null {
  const found = bindings.find((b) => b.key === comboKey);
  return found ? found.action : null;
}
