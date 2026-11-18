package dev.jkchappy.portal.form.dto;

import dev.jkchappy.portal.form.FormTemplate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

// url: 미리보기와 다운로드에 쓰는 파일 주소
public record FormResponse(Long id, String name, String contentType, long size, String uploadedByName,
  OffsetDateTime createdAt, String url) {

  public static FormResponse from(FormTemplate form, String uploadedByName) {
    return new FormResponse(form.getId(), form.getOriginalName(), form.getContentType(), form.getSize(),
      uploadedByName, form.getCreatedAt().atOffset(ZoneOffset.UTC), "/api/forms/" + form.getId() + "/download");
  }
}
