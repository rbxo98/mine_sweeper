// shell 빌드 후, apps/game-a · apps/game-b의 dist 산출물을 shell/dist/games/{a,b}로 합친다.
// 존재하지 않는 게임은 건너뛴다.
//
// 주의: 연결된 워크스페이스 폴더는 한 번 쓰여진 파일을 삭제할 수 없다 (마운트 제약).
// 그래서 destDir를 먼저 지우고 복사하는 방식(rmSync 후 cpSync) 대신, 항상 덮어쓰기만 한다.
// cpSync(force: true)는 동일 경로 파일을 덮어쓰지만, 이전 빌드에만 있던(현재는 없는)
// 파일은 지워지지 않고 남을 수 있다 — 현재 요건에서는 감수 가능한 트레이드오프.
import { existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.resolve(__dirname, '..', '..');
const shellDistDir = path.resolve(__dirname, '..', 'dist');

const GAMES = [
  { dir: 'game-a', slug: 'a' },
  { dir: 'game-b', slug: 'b' },
];

for (const { dir, slug } of GAMES) {
  const srcDist = path.join(appsDir, dir, 'dist');
  const destDir = path.join(shellDistDir, 'games', slug);

  if (!existsSync(srcDist)) {
    console.log(`[shell:postbuild] ${dir}/dist 없음 - 건너뜁니다.`);
    continue;
  }

  cpSync(srcDist, destDir, { recursive: true, force: true });
  console.log(`[shell:postbuild] ${dir} -> dist/games/${slug} 복사(덮어쓰기) 완료`);
}
