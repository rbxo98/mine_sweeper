import { defineConfig } from 'vite';

// base: './' — 이 게임은 shell의 dist/games/b/ 하위 경로(또는 iframe)에서도 로드된다.
// 기본값(base: '/')이면 빌드된 자산 경로가 사이트 루트 기준 절대경로("/assets/...")가 되어
// 하위 경로에서 열었을 때 자산을 못 찾는다 — 상대경로로 바꿔 어디서 열어도 동작하게 한다.
export default defineConfig({
  base: './',
});
