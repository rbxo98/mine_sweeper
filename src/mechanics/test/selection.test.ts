import { describe, expect, it } from 'vitest';
import { SelectionController } from '../selection';

describe('SelectionController', () => {
  it('beginDrag는 미선택 칸에서 select 모드로 시작해 그 칸을 바로 선택한다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', true);
    expect(s.dragMode).toBe('select');
    expect(s.selected.has('a')).toBe(true);
  });

  it('beginDrag는 이미 선택된 칸에서는 deselect 모드로 시작해 그 칸을 바로 해제한다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', true);
    s.endDrag();
    s.beginDrag('a', true);
    expect(s.dragMode).toBe('deselect');
    expect(s.selected.has('a')).toBe(false);
  });

  it('isSelectable이 false면 beginDrag/applyDrag 모두 아무 효과가 없다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', false);
    expect(s.dragMode).toBe(null);
    expect(s.selected.size).toBe(0);
  });

  it('applyDrag는 현재 dragMode를 그대로 적용해 여러 칸에 전파된다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', true);
    s.applyDrag('b', true);
    s.applyDrag('c', true);
    expect([...s.selected].sort()).toEqual(['a', 'b', 'c']);
  });

  it('endDrag 이후에는 applyDrag가 아무 효과도 없다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', true);
    s.endDrag();
    s.applyDrag('b', true);
    expect(s.selected.has('b')).toBe(false);
  });

  it('extend는 isSelectable을 만족하는 후보만 토글 없이 추가하고, 뭔가 바뀌었으면 true를 반환한다', () => {
    const s = new SelectionController<string>();
    const changed = s.extend(['a', 'b', 'c'], (k) => k !== 'b');
    expect(changed).toBe(true);
    expect([...s.selected].sort()).toEqual(['a', 'c']);

    const changedAgain = s.extend(['a', 'c'], () => true);
    expect(changedAgain).toBe(false); // 이미 다 선택돼 있어 변화 없음
  });

  it('deselect는 지정한 키 하나만 제거하고 나머지 선택은 유지한다', () => {
    const s = new SelectionController<string>();
    s.extend(['a', 'b', 'c'], () => true);
    s.deselect('b');
    expect([...s.selected].sort()).toEqual(['a', 'c']);
  });

  it('commit은 선택 전체를 반환하고 내부 선택 집합을 비운다', () => {
    const s = new SelectionController<string>();
    s.extend(['a', 'b'], () => true);
    const committed = s.commit();
    expect(committed.sort()).toEqual(['a', 'b']);
    expect(s.selected.size).toBe(0);
  });

  it('clear는 선택과 dragMode를 모두 초기화한다', () => {
    const s = new SelectionController<string>();
    s.beginDrag('a', true);
    s.clear();
    expect(s.selected.size).toBe(0);
    expect(s.dragMode).toBe(null);
  });
});
