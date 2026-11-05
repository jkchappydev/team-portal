FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# npm 캐시는 BuildKit 캐시 마운트로 빌드 간 재사용
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src src
# 빌드 후 개발 의존성 제거
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 1234
CMD ["node", "dist/index.js"]
