import { useEffect } from 'react';
import { Platform } from 'react-native';
import { normalizeKeyCombo } from './keyboardCombo';
import type { KeymapStore } from './keymapStore';
import { globalKeymapStore } from './keymapStore';
import type { GameInputAction } from './types';

/**
 * 키보드는 여러 입력 소스 중 하나일 뿐이다(터치가 GameScreen.tsx의 GestureDetector로
 * 이미 있고, 나중에 게임패드 등이 추가될 수도 있다) — 이 훅은 "물리 키보드 -> 추상
 * GameInputAction" 변환만 책임지고, 그 액션을 실제 게임 동작으로 바꾸는 건 호출부
 * (GameScreen.tsx)의 몫이다. 물리 키 조합 -> 액션 매핑 자체는 이 파일이 몰라도 되게
 * KeymapStore에 위임한다(store만 바꾸면 이 훅은 그대로 재사용된다).
 *
 * 물리 키보드는 사실상 웹/데스크톱 얘기라 Platform.OS === 'web'일 때만 리스너를 붙인다
 * — 네이티브(iOS/Android)에서 외장 키보드를 지원하려면 별도의 입력 소스 구현체가
 * 필요할 것이다(RN 기본 Keyboard API는 소프트 키보드 이벤트라 이 용도가 아니다).
 */
export function useKeyboardInput(onAction: (action: GameInputAction) => void, store: KeymapStore = globalKeymapStore): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      const combo = normalizeKeyCombo(event);
      const action = store.resolve(combo);
      if (!action) return;
      event.preventDefault();
      onAction(action);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAction, store]);
}
