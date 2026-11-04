package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record DocumentSummary(Long id, Long spaceId, String spaceName, String title,
  String updatedByName, OffsetDateTime updatedAt) {

  public static DocumentSummary from(Document doc, String spaceName, String updatedByName) {
    return new DocumentSummary(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(),
      updatedByName, doc.getUpdatedAt().atOffset(ZoneOffset.UTC));
  }
}
