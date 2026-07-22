import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameScreen } from './src/screens/GameScreen';

// 독립 프로젝트 1개, 화면도 1개뿐이라 "셸/탭"으로 감쌀 이유가 없다 — 제목 표시줄 +
// 게임 화면을 이 파일 하나에서 바로 그린다. A의 개별 기능들은 "선택 가능한 별도
// 게임"이 아니라 앞으로 이 화면 자체의 옵션/시스템으로 녹아들 예정이다
// ([[decisions/2026-07-22-cherry-pick-a-into-b]] 참고).
function Main(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>NAN 2026</Text>
        <Text style={styles.subtitle}>지뢰밭정찰대</Text>
      </View>
      <View style={[styles.stage, { marginBottom: Math.max(insets.bottom, 16) }]}>
        <GameScreen />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Main />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111318' },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  title: { color: '#f2f2f2', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#9aa0ab', fontSize: 13, fontWeight: '600' },
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
