package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

// 협업 서버가 전달하는 문서 본문 (state는 Base64)
// mentionedMemberIds: 본문에서 @로 언급된 팀원 ID (null이면 언급 정보를 보내지 않는 협업 서버라 기존 언급 유지)
public record CollabContentRequest(@NotNull String state, @NotNull String plainText, Long updatedBy,
  List<Long> mentionedMemberIds) {
}
