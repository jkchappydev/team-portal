package dev.jkchappy.portal.link.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 제목과 주소로 링크 추가 (둘 다 필수, 아이콘은 선택)
public record LinkCreateRequest(
  @NotBlank @Size(max = 2000) String url,
  @NotBlank @Size(max = 100) String title,
  @Size(max = 32) String icon) {

  public LinkCreateRequest(String url, String title) {
    this(url, title, null);
  }
}
