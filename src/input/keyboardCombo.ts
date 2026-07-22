/**
 * KeyboardEvent -> keymap.ts가 조회에 쓰는 조합 문자열로 정규화하는 순수 함수.
 * DOM에 의존하지 않도록 필요한 필드만 좁은 타입으로 받는다(테스트하기 쉽게, 실제
 * KeyboardEvent도 이 필드들을 그대로 갖고 있으니 그냥 넘기면 된다).
 */
export interface KeyComboInput {
  key: string;
  shiftKey: boolean;
}

/**
 * 화살표 키 등 여러 글자짜리 키 이름(예: "ArrowUp")은 대소문자를 그대로 두고,
 * 한 글자짜리 키(예: "W", "w")는 소문자로 정규화한다 — Shift를 누르면 브라우저가
 * event.key를 대문자로 주기 때문에("W") Shift+대문자와 Shift+소문자가 다른 키로
 * 인식되지 않게 하기 위함.
 */
export function normalizeKeyCombo(event: KeyComboInput): string {
  const rawKey = event.key;
  const normalizedKey = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
  return event.shiftKey ? `Shift+${normalizedKey}` : normalizedKey;
}
