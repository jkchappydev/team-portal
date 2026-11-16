package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

// 메인 화면 새 게시글 한 줄 (만든 사람·만든 시각 기준), kind: PAGE 또는 FILE
public record RecentDocument(Long id, Long spaceId, String spaceName, String title, String icon, String kind,
  String createdByName, OffsetDateTime createdAt) {

  public static RecentDocument from(Document doc, String spaceName, String createdByName) {
    return new RecentDocument(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(), doc.getIcon(),
      doc.getKind().name(), createdByName, doc.getCreatedAt().atOffset(ZoneOffset.UTC));
  }
}
