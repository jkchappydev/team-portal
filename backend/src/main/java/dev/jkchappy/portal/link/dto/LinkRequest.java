package dev.jkchappy.portal.link.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 링크 추가·수정 요청 (제목과 주소는 필수, 아이콘은 선택)
public record LinkRequest(
  @NotBlank @Size(max = 2000) String url,
  @NotBlank @Size(max = 100) String title,
  @Size(max = 32) String icon) {

  public LinkRequest(String url, String title) {
    this(url, title, null);
  }
}
