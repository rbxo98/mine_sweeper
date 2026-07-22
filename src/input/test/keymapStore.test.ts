import { describe, expect, it, vi } from 'vitest';
import { KeymapStore } from '../keymapStore';
import { defaultKeyBindings } from '../keymap';

describe('KeymapStore', () => {
  it('기본 바인딩으로 키를 해석한다', () => {
    const store = new KeymapStore();
    expect(store.resolve('ArrowUp')).toEqual({ type: 'directional', direction: 'up', kind: 'primary' });
  });

  it('setBindings로 통째로 갈아끼우면 이후 조회에 새 바인딩이 쓰인다', () => {
    const store = new KeymapStore();
    store.setBindings([{ key: 'j', action: { type: 'directional', direction: 'down', kind: 'primary' } }]);

    expect(store.resolve('j')).toEqual({ type: 'directional', direction: 'down', kind: 'primary' });
    expect(store.resolve('ArrowUp')).toBeNull(); // 예전 기본 바인딩은 더 이상 없음
  });

  it('setBindings 시 구독자에게 알린다', () => {
    const store = new KeymapStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setBindings(defaultKeyBindings);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('구독 해지 후에는 알림을 받지 않는다', () => {
    const store = new KeymapStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.setBindings(defaultKeyBindings);

    expect(listener).not.toHaveBeenCalled();
  });
});
