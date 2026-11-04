package dev.jkchappy.portal.attachment.dto;

import dev.jkchappy.portal.attachment.Attachment;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record AttachmentResponse(Long id, String originalName, String contentType, long size,
  String uploadedByName, OffsetDateTime createdAt, String url) {

  public static AttachmentResponse from(Attachment a, String uploadedByName) {
    return new AttachmentResponse(a.getId(), a.getOriginalName(), a.getContentType(), a.getSize(),
      uploadedByName, a.getCreatedAt().atOffset(ZoneOffset.UTC),
      "/api/attachments/" + a.getId() + "/download");
  }
}
