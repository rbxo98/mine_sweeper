import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GAMES, type GameEntry } from './games';

// apps/shell/src/main.ts + style.css(웹 셸)의 "상단 제목+탭, 하단 스테이지" 구조를 RN으로
// 재구현한 것 — task #14. 웹 셸은 게임마다 독립 빌드된 페이지를 iframe으로 얹어 탭 전환
// 하지만, RN 쪽은 game-a/b가 이미 같은 번들 안에 있으므로 컴포넌트 스왑으로 대체한다
// ([[decisions/2026-07-22-rn-shell]] 참고). 색상 값은 apps/shell/src/style.css와 동일하게
// 맞춰 웹/RN 두 셸의 시각적 일관성을 유지한다.
//
// GameAScreen/GameBScreen은 이 파일이 어떻게 배치하든 전혀 손댈 필요가 없다 — 유일한
// 예외는 이 셸 도입 자체로 드러난 "window 폭이 아니라 실제 레이아웃 폭 기준 반응형"
// 수정(onLayout, task #14 세션 로그 참고)뿐이며, 그 수정도 각 화면 파일 안에서 끝났다.

function TabBar({
  active,
  onSelect,
}: {
  active: GameEntry['slug'];
  onSelect: (slug: GameEntry['slug']) => void;
}) {
  return (
    <View style={styles.tabs}>
      {GAMES.map((game) => {
        const isActive = game.slug === active;
        return (
          <Pressable
            key={game.slug}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelect(game.slug)}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{game.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ShellApp(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<GameEntry['slug']>(GAMES[0]!.slug);
  const current = GAMES.find((g) => g.slug === active)!;
  const CurrentScreen = current.Screen;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>NAN 2026</Text>
        <TabBar active={active} onSelect={setActive} />
      </View>
      <View style={[styles.stage, { marginBottom: Math.max(insets.bottom, 16) }]}>
        <CurrentScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111318' },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  title: { color: '#f2f2f2', fontSize: 20, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2d35',
    backgroundColor: '#181a20',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#23262e', borderColor: '#4d7cff' },
  tabLabel: { color: '#9aa0ab', fontSize: 14, fontWeight: '600' },
  tabLabelActive: { color: '#f2f2f2' },
  stage: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2d35',
    backgroundColor: '#0b0c10',
    overflow: 'hidden',
  },
});
