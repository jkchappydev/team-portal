package dev.jkchappy.portal.document;

import java.util.Locale;
import java.util.Set;

// 파일 항목의 확장자별 기본 아이콘 (엑셀·워드·한글·PPT·PDF·이미지 외에는 기본 파일 아이콘)
public final class FileIcons {

  private FileIcons() {
  }

  public static String forName(String name) {
    int dot = name == null ? -1 : name.lastIndexOf('.');
    String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    if (Set.of("xlsx", "xls", "csv").contains(ext)) {
      return "📊";
    }
    if (Set.of("docx", "doc", "hwp", "hwpx", "txt").contains(ext)) {
      return "📝";
    }
    if (Set.of("pptx", "ppt").contains(ext)) {
      return "📽️";
    }
    if (ext.equals("pdf")) {
      return "📕";
    }
    if (Set.of("png", "jpg", "jpeg", "gif", "webp", "svg").contains(ext)) {
      return "🖼️";
    }
    if (Set.of("zip", "7z", "tar", "gz").contains(ext)) {
      return "🗜️";
    }
    return "📎";
  }
}
