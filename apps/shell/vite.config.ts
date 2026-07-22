import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 등 서브패스(/저장소이름/)에서 서빙될 때 절대경로(/assets/...)가 깨지지 않도록
  // game-a/game-b와 동일하게 상대경로 base를 쓴다.
  base: './',
  build: {
    outDir: 'dist',
    // 연결된 워크스페이스 폴더는 한 번 쓰여진 파일을 삭제할 수 없다 (마운트 제약).
    // emptyOutDir: true(기본값)로 두면 재빌드 시 기존 dist를 지우려다 EPERM으로 실패한다.
    // 대신 매번 덮어쓰기만 하고, 오래된 해시 파일은 남는 것을 감수한다.
    emptyOutDir: false,
  },
});
