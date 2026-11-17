package dev.jkchappy.portal.document.property.dto;

import dev.jkchappy.portal.document.property.PropertyType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 새 속성 (값은 비어 있는 채로 맨 아래에 만듦)
public record PropertyCreateRequest(
  @NotBlank @Size(max = 50) String name,
  @NotNull PropertyType type) {
}
