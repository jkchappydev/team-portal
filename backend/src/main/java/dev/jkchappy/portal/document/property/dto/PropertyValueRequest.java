package dev.jkchappy.portal.document.property.dto;

import jakarta.validation.constraints.Size;

// 비우려면 null 또는 빈 글
public record PropertyValueRequest(@Size(max = 2000) String value) {
}
