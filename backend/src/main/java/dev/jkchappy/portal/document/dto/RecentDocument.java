package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

// 메인 화면 최근 수정된 게시글 한 줄 (마지막 수정자·수정 시각 기준), kind: PAGE 또는 FILE
public record RecentDocument(Long id, Long spaceId, String spaceName, String title, String icon, String kind,
  String updatedByName, OffsetDateTime updatedAt) {

  public static RecentDocument from(Document doc, String spaceName, String updatedByName) {
    return new RecentDocument(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(), doc.getIcon(),
      doc.getKind().name(), updatedByName, doc.getUpdatedAt().atOffset(ZoneOffset.UTC));
  }
}
