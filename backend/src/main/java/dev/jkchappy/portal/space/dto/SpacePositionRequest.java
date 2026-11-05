package dev.jkchappy.portal.space.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 사이드바 최상위 페이지 목록에서 들어갈 위치 (0이 맨 위)
public record SpacePositionRequest(@NotNull @Min(0) Integer index) {
}
