import { defaultKeyBindings, resolveAction, type KeyBinding } from './keymap';
import type { GameInputAction } from './types';

/**
 * 현재 키맵을 들고 있는 전역 스토어 — "무슨 키 = 무슨 액션"이 코드 여기저기 하드코딩되지
 * 않고 이 한 곳(교체 가능한 상태)으로 모이게 하는 게 목적이다. 지금은 기본 키맵만 채워서
 * 내보내지만, 나중에 설정 화면이 생기면 setBindings()로 통째로 갈아끼우면 된다(그때
 * 영구 저장이 필요하면 이 클래스 밖에서 AsyncStorage/localStorage와 연결하면 되고,
 * 이 클래스 자체는 저장소를 몰라도 된다).
 *
 * GameBController(src/engine/controller.ts)의 subscribe/notify와 같은 패턴 —
 * useSyncExternalStore로 React에 연결하기 쉽게.
 */
export class KeymapStore {
  private _bindings: readonly KeyBinding[];
  private readonly listeners = new Set<() => void>();

  constructor(initial: readonly KeyBinding[] = defaultKeyBindings) {
    this._bindings = initial;
  }

  get bindings(): readonly KeyBinding[] {
    return this._bindings;
  }

  setBindings(bindings: readonly KeyBinding[]): void {
    this._bindings = bindings;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  resolve(comboKey: string): GameInputAction | null {
    return resolveAction(comboKey, this._bindings);
  }
}

/** 앱 전체가 공유하는 기본 인스턴스. 화면/훅은 이 인스턴스를 직접 import해서 쓴다 —
 * 나중에 설정 화면도 같은 인스턴스를 갈아끼우면 모든 입력 소스에 즉시 반영된다. */
export const globalKeymapStore = new KeymapStore();
