import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { version as canvasKitVersion } from 'canvaskit-wasm/package.json';

// 웹에서는 Skia(CanvasKit)가 WASM으로 비동기 로드된다 — 네이티브(iOS/Android)처럼
// Skia 바인딩이 동기적으로 바로 쓸 수 있는 게 아니다. GameBScreen.tsx 등이 모듈
// 최상단에서 `Skia.Font(...)`를 즉시 호출하기 때문에, CanvasKit이 준비되기 전에
// App을 평가하면 "Cannot read properties of undefined (reading 'Font')" 에러가 난다.
//
// 그래서 App을 이 파일 맨 위에서 정적 import하지 않고, LoadSkiaWeb()가 끝난 뒤에만
// 동적 import로 불러온다 — react-native-skia 공식 문서의 "Deferred Component
// Registration" 패턴 그대로. Metro가 웹 번들링 시 index.ts 대신 이 파일을 자동으로
// 골라 쓴다(플랫폼별 확장자 해석). 네이티브 빌드는 이 파일과 무관하게 index.ts를 쓴다.
//
// canvaskit.wasm은 로컬 public/ 폴더 대신 CDN(jsdelivr)에서 로드한다 — `expo start
// --web`(dev 서버)이 워크스페이스 구조 때문인지 public/ 폴더의 정적 파일을 제대로 못
// 서빙해 "Incorrect response MIME type"/HTML 폴백 에러가 났다(`expo export -p web`
// 정적 빌드에서는 문제 없었을 가능성이 높음 — dev 서버만의 이슈). CDN 로딩은 이 문제
// 자체를 피해간다. 버전은 설치된 canvaskit-wasm과 반드시 일치해야 하므로 package.json에서
// 직접 읽어온다.
LoadSkiaWeb({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${canvasKitVersion}/bin/full/${file}`,
}).then(async () => {
  const { default: App } = await import('./App');
  registerRootComponent(App);
});
