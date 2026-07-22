import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameScreen } from './src/screens/GameScreen';

// 독립 프로젝트 1개, 화면도 1개뿐이라 "셸/탭"으로 감쌀 이유가 없다. 제목표시줄 같은
// 웹 chrome도 걷어냈다 — 게임 정보(HUD)는 이미 캔버스 안에서 그려지므로(GameScreen.tsx
// buildScene) 바깥에 따로 UI가 필요 없다. 캔버스가 화면을 꽉 채우고, 세이프에리어
// (노치 등)만 침범하지 않도록 최소 패딩만 둔다.
function Main(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <GameScreen />
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
  root: { flex: 1, backgroundColor: '#0b0c10' },
});
