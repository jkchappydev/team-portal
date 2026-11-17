package dev.jkchappy.portal.document.property.dto;

import jakarta.validation.constraints.Min;

// 옮긴 뒤 목록에서의 위치 (0부터)
public record PropertyOrderRequest(@Min(0) int index) {
}
