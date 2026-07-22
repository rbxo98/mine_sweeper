import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShellApp } from './src/shell/ShellApp';

// 이 파일은 플랫폼 공통 프로바이더(제스처 루트, 세이프에리어)만 배선한다 — 실제 셸
// (제목/탭/스테이지)은 task #14에서 신설한 src/shell/ShellApp.tsx가 전담한다.
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShellApp />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
