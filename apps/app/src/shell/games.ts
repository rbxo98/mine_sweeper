import type { ComponentType } from 'react';
import { GameAScreen } from '../games/gameA/GameAScreen';
import { GameBScreen } from '../games/gameB/GameBScreen';

// apps/shell/src/main.ts(웹 셸)의 `GameEntry[]`와 대응되는 목록. 웹 셸은 slug로 iframe
// (`./games/{slug}/`)의 src를 바꿔 전환하지만, RN에는 iframe이 없고 애초에 game-a/b가
// 같은 번들 안에 들어있으므로 slug로 화면 컴포넌트를 바꾸는 방식으로 대체한다.
// 게임이 하나 더 늘어나도 이 배열에 한 줄만 추가하면 되고 ShellApp.tsx나 각
// GameXScreen은 손댈 필요가 없다 — "핵심부분 최소수정" 원칙.
export interface GameEntry {
  slug: 'a' | 'b';
  title: string;
  Screen: ComponentType;
}

export const GAMES: readonly GameEntry[] = [
  { slug: 'a', title: '지뢰추적자', Screen: GameAScreen },
  { slug: 'b', title: '지뢰밭정찰대', Screen: GameBScreen },
];
