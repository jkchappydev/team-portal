package dev.jkchappy.portal.document.dto;

import java.time.OffsetDateTime;

// 수정 이력 목록 한 줄 (본문 없이 시각·수정자·종류만)
public record HistoryEntry(Long id, OffsetDateTime createdAt, String createdByName, String reason) {
}
