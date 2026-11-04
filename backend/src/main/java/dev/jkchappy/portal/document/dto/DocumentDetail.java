package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record DocumentDetail(Long id, Long spaceId, String spaceName, String title,
  String createdByName, String updatedByName, OffsetDateTime updatedAt) {

  public static DocumentDetail from(Document doc, String spaceName, String createdByName,
    String updatedByName) {
    return new DocumentDetail(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(),
      createdByName, updatedByName, doc.getUpdatedAt().atOffset(ZoneOffset.UTC));
  }
}
