package dev.jkchappy.portal.attachment;

import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

// 업로드 파일의 이름과 Content-Type 정리 (첨부와 양식 업로드 공용)
public final class UploadFiles {

  private static final int MAX_NAME_LENGTH = 255;
  private static final int MAX_CONTENT_TYPE_LENGTH = 150;
  private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

  private UploadFiles() {
  }

  // 경로 구분자를 제거하고 길이 제한 적용
  public static String sanitizeName(String name) {
    String base = name == null ? "" : name.replace('\\', '/');
    base = base.substring(base.lastIndexOf('/') + 1).trim();
    if (base.isEmpty()) {
      base = "file";
    }
    return base.length() > MAX_NAME_LENGTH ? base.substring(0, MAX_NAME_LENGTH) : base;
  }

  // 잘못된 형식이거나 컬럼 길이를 넘는 타입은 기본 타입으로 대체
  public static String resolveContentType(MultipartFile file) {
    String type = file.getContentType();
    if (type == null || type.isBlank()) {
      return DEFAULT_CONTENT_TYPE;
    }
    try {
      String parsed = MediaType.parseMediaType(type).toString();
      return parsed.length() > MAX_CONTENT_TYPE_LENGTH ? DEFAULT_CONTENT_TYPE : parsed;
    } catch (InvalidMediaTypeException e) {
      return DEFAULT_CONTENT_TYPE;
    }
  }
}
