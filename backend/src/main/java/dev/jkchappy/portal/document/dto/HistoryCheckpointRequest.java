package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 되돌리기 직전 본문 (Yjs 상태, JSON에서는 Base64)
public record HistoryCheckpointRequest(@NotNull @Size(min = 1) byte[] contentState) {
}
