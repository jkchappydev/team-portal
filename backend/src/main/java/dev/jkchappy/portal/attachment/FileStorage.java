package dev.jkchappy.portal.attachment;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

// 로컬 디스크 파일 저장소 (UUID 파일명만 사용)
@Component
public class FileStorage {

  private static final Pattern STORED_NAME = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

  private final Path root;

  public FileStorage(@Value("${app.storage.path}") String storagePath) {
    this.root = Path.of(storagePath).toAbsolutePath().normalize();
  }

  // 스트림을 UUID 이름으로 저장하고 저장 이름 반환
  public String save(InputStream in) {
    String storedName = UUID.randomUUID().toString();
    try {
      Files.createDirectories(root);
      Files.copy(in, root.resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException e) {
      throw new UncheckedIOException("파일 저장에 실패했습니다.", e);
    }
    return storedName;
  }

  // 저장 이름 형식이 아니거나 파일이 없으면 없는 파일로 취급
  public Resource load(String storedName) {
    Path path = resolve(storedName);
    if (path == null || !Files.isRegularFile(path)) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }
    return new FileSystemResource(path);
  }

  public void delete(String storedName) {
    Path path = resolve(storedName);
    if (path == null) {
      return;
    }
    try {
      Files.deleteIfExists(path);
    } catch (IOException e) {
      throw new UncheckedIOException("파일 삭제에 실패했습니다.", e);
    }
  }

  // 경로 탈출 방지를 위해 UUID 형식만 허용
  private Path resolve(String storedName) {
    if (storedName == null || !STORED_NAME.matcher(storedName).matches()) {
      return null;
    }
    return root.resolve(storedName);
  }
}
