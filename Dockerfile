# NAN 2026 — shell(+game-a, game-b) 정적 빌드를 nginx로 서빙하는 이미지.
# 루트 `npm run build`가 game-a → game-b → shell 순으로 빌드하고, shell/dist/games/{a,b}로
# 복사까지 끝낸다([[decisions/2026-07-21-monorepo-with-independent-game-builds]]) — 이 한 번의
# 빌드 산출물(apps/shell/dist)만 정적으로 서빙하면 되므로 이미지는 빌드 스테이지 + nginx
# 서빙 스테이지 2단으로 충분하다.

# ---- 1) 빌드 스테이지 ----
FROM node:22-alpine AS build
WORKDIR /app

# 워크스페이스 package.json/lockfile만 먼저 복사해 npm ci 레이어를 캐싱한다 —
# 소스만 바뀌고 의존성이 그대로면 이 레이어는 재빌드되지 않는다.
COPY package.json package-lock.json ./
COPY apps/shell/package.json apps/shell/package.json
COPY apps/game-a/package.json apps/game-a/package.json
COPY apps/game-b/package.json apps/game-b/package.json
RUN npm ci

# 나머지 소스 복사 후 루트 캐스케이드 빌드 실행.
COPY tsconfig.base.json ./
COPY apps ./apps
RUN npm run build

# ---- 2) 서빙 스테이지 ----
FROM nginx:alpine AS serve
COPY --from=build /app/apps/shell/dist /usr/share/nginx/html
EXPOSE 80
