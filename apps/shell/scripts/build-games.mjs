// shell 빌드 전, apps/game-a · apps/game-b가 존재하면 먼저 빌드한다.
// 아직 스캐폴딩되지 않은 게임은 건너뛴다 — shell은 항상 단독으로도 빌드 가능해야 한다.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.resolve(__dirname, '..', '..');

const GAMES = ['game-a', 'game-b'];

for (const game of GAMES) {
  const gameDir = path.join(appsDir, game);
  const pkgPath = path.join(gameDir, 'package.json');

  if (!existsSync(pkgPath)) {
    console.log(`[shell:prebuild] ${game} 프로젝트가 아직 없어 건너뜁니다.`);
    continue;
  }

  console.log(`[shell:prebuild] ${game} 빌드 시작`);
  execSync('npm run build', { cwd: gameDir, stdio: 'inherit' });
}
