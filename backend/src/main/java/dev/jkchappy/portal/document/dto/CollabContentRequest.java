package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.NotNull;

// 협업 서버가 전달하는 문서 본문 (state는 Base64)
public record CollabContentRequest(@NotNull String state, @NotNull String plainText, Long updatedBy) {
}
