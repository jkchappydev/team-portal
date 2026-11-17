package dev.jkchappy.portal.notification.dto;

import dev.jkchappy.portal.document.dto.DocumentSummary;
import java.time.OffsetDateTime;

// 수정 알림 한 건: 페이지 요약(DocumentSummary와 같은 필드) + 나를 @언급해서 온 알림인지
public record DocumentUpdateResponse(Long id, Long spaceId, String spaceName, String title, String icon,
  String updatedByName, OffsetDateTime updatedAt, Long parentId, String kind, String fileUrl, boolean mentioned) {

  public static DocumentUpdateResponse of(DocumentSummary doc, boolean mentioned) {
    return new DocumentUpdateResponse(doc.id(), doc.spaceId(), doc.spaceName(), doc.title(), doc.icon(),
      doc.updatedByName(), doc.updatedAt(), doc.parentId(), doc.kind(), doc.fileUrl(), mentioned);
  }
}
