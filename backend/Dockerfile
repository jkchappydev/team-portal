# 빌드 단계: Gradle 래퍼로 실행 가능한 jar 생성
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
# Gradle 캐시는 BuildKit 캐시 마운트로 빌드 간 재사용 (build.gradle이 바뀌어도 받은 의존성 유지)
RUN --mount=type=cache,target=/root/.gradle \
  chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true
COPY src src
RUN --mount=type=cache,target=/root/.gradle \
  ./gradlew --no-daemon bootJar -x test && rm -f build/libs/*-plain.jar

# 실행 단계: JRE만 포함
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
RUN mkdir -p /app/storage
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
