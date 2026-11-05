package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Size;

// icon: 이모지 (null이거나 비어 있으면 아이콘 제거)
public record DocumentIconRequest(@Size(max = 32) String icon) {
}
