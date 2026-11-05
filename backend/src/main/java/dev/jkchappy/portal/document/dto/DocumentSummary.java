package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

// parentId: 상위 페이지 (null이면 최상위), kind: PAGE 또는 FILE, fileUrl: 파일 항목의 다운로드 주소
public record DocumentSummary(Long id, Long spaceId, String spaceName, String title, String icon,
  String updatedByName, OffsetDateTime updatedAt, Long parentId, String kind, String fileUrl) {

  public static DocumentSummary from(Document doc, String spaceName, String updatedByName) {
    String fileUrl = doc.isFile() && doc.getAttachmentId() != null
      ? "/api/attachments/" + doc.getAttachmentId() + "/download" : null;
    return new DocumentSummary(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(),
      doc.getIcon(), updatedByName, doc.getUpdatedAt().atOffset(ZoneOffset.UTC), doc.getParentId(),
      doc.getKind().name(), fileUrl);
  }
}
