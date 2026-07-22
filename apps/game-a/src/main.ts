import './style.css';
import { Application } from 'pixi.js';
import { GameView } from './view/GameView';

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({ background: '#111318', antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });

  const mount = document.querySelector<HTMLDivElement>('#app');
  mount?.appendChild(app.canvas);
  app.canvas.oncontextmenu = () => false; // 우클릭 = 깃발이라 브라우저 컨텍스트 메뉴를 막는다

  const view = new GameView(app);
  view.start();
}

bootstrap();
