import './style.css';

interface GameEntry {
  slug: 'a' | 'b';
  title: string;
}

// 게임이 아직 스캐폴딩되지 않았어도 셸 자체는 항상 렌더링된다.
// 실제 존재 여부는 빌드 단계(scripts/copy-games.mjs)에서 dist/games/{a,b}로 반영된다.
// 각 게임은 독립 빌드된 별도 페이지([[decisions/2026-07-21-monorepo-with-independent-game-builds]])라
// 번들을 합치지 않고 iframe으로 얹어 탭 전환한다.
const games: GameEntry[] = [
  { slug: 'a', title: '지뢰추적자' },
  { slug: 'b', title: '지뢰밭정찰대' },
];

let current: GameEntry['slug'] = games[0]!.slug;

function render(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  const currentGame = games.find((g) => g.slug === current)!;

  app.innerHTML = `
    <div class="shell">
      <header class="shell__header">
        <h1>NAN 2026</h1>
        <nav class="shell__tabs">
          ${games
            .map(
              (game) => `
                <button
                  class="shell__tab${game.slug === current ? ' shell__tab--active' : ''}"
                  data-slug="${game.slug}"
                  type="button"
                >${game.title}</button>
              `
            )
            .join('')}
        </nav>
      </header>
      <div class="shell__stage">
        <iframe class="shell__frame" src="./games/${current}/" title="${currentGame.title}"></iframe>
      </div>
    </div>
  `;

  app.querySelectorAll<HTMLButtonElement>('.shell__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.slug as GameEntry['slug'];
      if (slug === current) return;
      current = slug;
      render();
    });
  });
}

render();
