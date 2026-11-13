package dev.jkchappy.portal.link.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 사이드바 링크 목록에서 들어갈 위치 (0이 맨 위)
public record LinkPositionRequest(@NotNull @Min(0) Integer index) {
}
