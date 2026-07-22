import { describe, expect, it } from 'vitest';
import { defaultKeyBindings, resolveAction } from '../keymap';

describe('defaultKeyBindings', () => {
  it('같은 키 문자열이 중복 정의되지 않는다', () => {
    const keys = defaultKeyBindings.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('방향키 4개와 WASD 4개가 전부 주 동작(이동)으로 매핑된다', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']) {
      const action = resolveAction(key, defaultKeyBindings);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('directional');
      if (action?.type === 'directional') expect(action.kind).toBe('primary');
    }
  });

  it('Shift+방향키/WASD는 보조 동작(해체)으로 매핑된다', () => {
    for (const key of ['Shift+ArrowUp', 'Shift+ArrowDown', 'Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+w', 'Shift+a', 'Shift+s', 'Shift+d']) {
      const action = resolveAction(key, defaultKeyBindings);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('directional');
      if (action?.type === 'directional') expect(action.kind).toBe('secondary');
    }
  });

  it('r은 재시작으로 매핑된다', () => {
    expect(resolveAction('r', defaultKeyBindings)).toEqual({ type: 'restart' });
  });
});

describe('resolveAction', () => {
  it('바인딩에 없는 키는 null을 반환한다', () => {
    expect(resolveAction('F1', defaultKeyBindings)).toBeNull();
  });
});
