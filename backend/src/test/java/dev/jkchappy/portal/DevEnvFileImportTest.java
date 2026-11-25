package dev.jkchappy.portal;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

// 로컬 개발용 .env-develop 파일을 application.yml의 import 형식 그대로 읽었을 때 한글 값이 깨지지 않는지 확인
class DevEnvFileImportTest {

  @Configuration(proxyBeanMethods = false)
  static class EmptyConfig {
  }

  @Test
  void importsDevEnvFileAsUtf8(@TempDir Path dir) throws IOException {
    Path envFile = dir.resolve(".env-develop");
    Files.writeString(envFile, "MONITOR_REMOTE_SERVERS=10.0.0.6 (테스트 서버)=http://example.invalid/metrics\n", StandardCharsets.UTF_8);

    for (String location : devEnvImports()) {
      // 같은 import 형식(인코딩 지정 포함)으로 경로만 임시 파일로 바꿔 읽음
      String pathPart = location.substring("optional:file:".length(), location.indexOf('['));
      String imported = location.replace(pathPart, envFile.toString().replace('\\', '/'));
      try (ConfigurableApplicationContext context = new SpringApplicationBuilder(EmptyConfig.class)
        .web(WebApplicationType.NONE)
        .logStartupInfo(false)
        .run("--spring.config.location=optional:classpath:/no-config/", "--spring.config.import=" + imported)) {
        assertThat(context.getEnvironment().getProperty("MONITOR_REMOTE_SERVERS"))
          .as(location)
          .isEqualTo("10.0.0.6 (테스트 서버)=http://example.invalid/metrics");
      }
    }
  }

  private List<String> devEnvImports() throws IOException {
    List<PropertySource<?>> sources = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
    PropertySource<?> main = sources.get(0);
    List<String> imports = new ArrayList<>();
    for (int i = 0; main.getProperty("spring.config.import[" + i + "]") != null; i++) {
      String location = String.valueOf(main.getProperty("spring.config.import[" + i + "]"));
      if (location.contains(".env-develop")) {
        imports.add(location);
      }
    }
    assertThat(imports).isNotEmpty();
    return imports;
  }
}
