package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.SnapshotReason;
import java.time.Instant;

// 본문을 읽지 않고 가져오는 사본 정보
public record SnapshotMeta(Long id, Instant createdAt, Long createdBy, SnapshotReason reason) {
}
