package dev.jkchappy.portal.document.dto;

import java.time.OffsetDateTime;

public record TrashItem(Long id, String name, OffsetDateTime deletedAt) {
}
