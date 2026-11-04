FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src src
# 빌드 후 개발 의존성 제거
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 1234
CMD ["node", "dist/index.js"]
