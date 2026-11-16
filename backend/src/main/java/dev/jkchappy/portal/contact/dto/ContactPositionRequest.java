package dev.jkchappy.portal.contact.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 연락처 목록에서 들어갈 위치 (0이 맨 위)
public record ContactPositionRequest(@NotNull @Min(0) Integer index) {
}
