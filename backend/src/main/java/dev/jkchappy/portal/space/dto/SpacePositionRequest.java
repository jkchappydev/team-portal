package dev.jkchappy.portal.space.dto;

import dev.jkchappy.portal.space.SpaceSection;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 옮겨 갈 구분(section) 목록 안에서 들어갈 위치 (0이 맨 위), section: 없으면 지금 구분 그대로
public record SpacePositionRequest(@NotNull @Min(0) Integer index, SpaceSection section) {
}
