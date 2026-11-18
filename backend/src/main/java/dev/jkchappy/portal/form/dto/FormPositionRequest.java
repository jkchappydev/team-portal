package dev.jkchappy.portal.form.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 양식 목록에서 들어갈 위치 (0이 맨 위)
public record FormPositionRequest(@NotNull @Min(0) Integer index) {
}
