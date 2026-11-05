# 빌드 단계: 정적 파일 생성
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm 캐시는 BuildKit 캐시 마운트로 빌드 간 재사용
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# 실행 단계: nginx로 정적 파일 서빙과 리버스 프록시
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
