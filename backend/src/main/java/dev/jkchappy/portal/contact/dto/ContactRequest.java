package dev.jkchappy.portal.contact.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

// 연락처 추가·수정 요청 (이름만 필수, 나머지는 선택)
public record ContactRequest(
  @NotBlank @Size(max = 50) String name,
  @Size(max = 100) String company,
  @Email @Size(max = 255) String email,
  @Size(max = 20) String phone,
  @Size(max = 20) List<@Size(max = 100) String> projects) {
}
