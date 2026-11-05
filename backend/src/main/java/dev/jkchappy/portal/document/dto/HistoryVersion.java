package dev.jkchappy.portal.document.dto;

import java.time.OffsetDateTime;

// 수정 이력 한 시점의 본문 (contentState는 Yjs 상태, JSON에서는 Base64)
public record HistoryVersion(Long id, OffsetDateTime createdAt, String createdByName, String reason,
  byte[] contentState) {
}
