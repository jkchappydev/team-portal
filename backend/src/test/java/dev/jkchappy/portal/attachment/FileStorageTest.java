package dev.jkchappy.portal.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;

class FileStorageTest {

  @TempDir
  Path tempDir;

  @Test
  void saveThenLoad_roundTrips() throws Exception {
    FileStorage storage = new FileStorage(tempDir.resolve("sub").toString());
    String storedName = storage.save(
      new ByteArrayInputStream("hello".getBytes(StandardCharsets.UTF_8)));

    Resource resource = storage.load(storedName);

    assertThat(new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8))
      .isEqualTo("hello");
    storage.delete(storedName);
    assertThat(Files.exists(tempDir.resolve("sub").resolve(storedName))).isFalse();
  }

  @Test
  void load_pathTraversalName_throwsNotFound() {
    FileStorage storage = new FileStorage(tempDir.toString());

    assertThatThrownBy(() -> storage.load("../x"))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }
}
