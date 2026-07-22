import { describe, expect, it } from 'vitest';
import { normalizeKeyCombo } from '../keyboardCombo';

describe('normalizeKeyCombo', () => {
  it('여러 글자 키(ArrowUp 등)는 대소문자를 그대로 둔다', () => {
    expect(normalizeKeyCombo({ key: 'ArrowUp', shiftKey: false })).toBe('ArrowUp');
    expect(normalizeKeyCombo({ key: 'ArrowUp', shiftKey: true })).toBe('Shift+ArrowUp');
  });

  it('한 글자 키는 소문자로 정규화한다 (Shift로 대문자가 와도)', () => {
    expect(normalizeKeyCombo({ key: 'w', shiftKey: false })).toBe('w');
    expect(normalizeKeyCombo({ key: 'W', shiftKey: true })).toBe('Shift+w');
  });

  it('Shift 없이 눌린 키는 접두사가 붙지 않는다', () => {
    expect(normalizeKeyCombo({ key: 'r', shiftKey: false })).toBe('r');
  });
});
