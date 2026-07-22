// 지뢰추적자(A)의 "여러 칸을 미리 선택해뒀다가 한 번에 커밋" 상호작용 패턴을 게임 규칙과
// 완전히 분리해 재사용 가능한 형태로 뽑은 것. 원래 game-a-core의
// GameAController.beginDragSelect/applyDragMode/chordSelect였다
// ([[decisions/2026-07-22-cherry-pick-a-into-b]] 참고).
//
// 의도적으로 "reveal"이라는 이름을 전혀 쓰지 않는다 — 커밋했을 때 실제로 무슨 일이
// 일어나는지(땅 공개든, 다른 어떤 미래 액션이든)는 이 클래스가 전혀 모른다. 오직 문자열
// 키 집합만 관리하고, "이 키가 지금 선택 가능한 상태인가"는 매번 호출자가 판단해서
// 넘겨준다 — 그래야 B의 게임 규칙(인접 칸만/특정 상태만 등)이 바뀌어도 이 파일은
// 손댈 필요가 없다.

export type DragMode = 'select' | 'deselect' | null;

export class SelectionController<TKey extends string = string> {
  private _selected = new Set<TKey>();
  private _dragMode: DragMode = null;

  get selected(): ReadonlySet<TKey> {
    return this._selected;
  }

  get dragMode(): DragMode {
    return this._dragMode;
  }

  /** 선택과 드래그 모드를 모두 초기화(예: 판이 재시작될 때). */
  clear(): void {
    this._selected = new Set();
    this._dragMode = null;
  }

  /**
   * 드래그/스와이프 시작. 시작 칸이 이미 선택 중이었으면 이번 드래그는 "해제" 모드,
   * 아니었으면 "선택" 모드로 정하고 그 칸부터 바로 적용한다. isSelectable이 false면
   * (예: 이미 공개된 칸) 아무 일도 일어나지 않는다.
   */
  beginDrag(key: TKey, isSelectable: boolean): void {
    if (!isSelectable) return;
    this._dragMode = this._selected.has(key) ? 'deselect' : 'select';
    this.applyDrag(key, isSelectable);
  }

  /** 드래그 중 새 칸을 지나갈 때마다 호출 — 현재 dragMode를 그대로 적용한다. */
  applyDrag(key: TKey, isSelectable: boolean): void {
    if (this._dragMode === null || !isSelectable) return;
    if (this._dragMode === 'select') this._selected.add(key);
    else this._selected.delete(key);
  }

  /** 드래그/스와이프 종료(포인터를 뗌). */
  endDrag(): void {
    this._dragMode = null;
  }

  /**
   * 코드 오픈(chording) 같은 연쇄 확장: candidateKeys 중 isSelectable을 만족하는 것들을
   * 전부 선택에 추가한다(토글이 아니라 항상 추가만 함). 실제로 뭔가 추가됐으면 true를
   * 반환 — 호출자가 리스너에게 알릴지 판단하는 데 쓸 수 있다.
   *
   * "언제 확장을 시도할지"(예: 공개된 숫자 칸 주변 깃발 수가 숫자 이상일 때)는 게임
   * 규칙이므로 이 메서드가 아니라 호출자가 candidateKeys를 넘기기 전에 판단해야 한다.
   */
  extend(candidateKeys: readonly TKey[], isSelectable: (key: TKey) => boolean): boolean {
    let changed = false;
    for (const key of candidateKeys) {
      if (!isSelectable(key)) continue;
      if (!this._selected.has(key)) {
        this._selected.add(key);
        changed = true;
      }
    }
    return changed;
  }

  /** 특정 키 하나만 선택에서 제거한다(예: 그 칸에 깃발을 꽂았을 때 그 칸만 선택 해제, 나머지는 유지). */
  deselect(key: TKey): void {
    this._selected.delete(key);
  }

  /** 현재 선택을 전부 비우고, 비우기 전의 키 배열을 반환한다(커밋 대상 목록으로 사용). */
  commit(): TKey[] {
    const keys = [...this._selected];
    this._selected = new Set();
    return keys;
  }
}
