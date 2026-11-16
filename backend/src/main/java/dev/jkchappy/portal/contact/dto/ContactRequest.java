package dev.jkchappy.portal.contact.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
// 연락처 추가·수정 요청 (이름만 필수, 나머지는 선택)
public record ContactRequest(
  @NotBlank @Size(max = 50) String name,
  @Size(max = 100) String company,
  @Email @Size(max = 255) String email,
  @Size(max = 20) String phone,
  @Size(max = 20) String phone2,
  @Size(max = 500) String project,
  @Size(max = 1000) String memo,
  // 비어 있으면 자동 색
  @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "색은 #RRGGBB 형식이어야 합니다.") String color) {
}
