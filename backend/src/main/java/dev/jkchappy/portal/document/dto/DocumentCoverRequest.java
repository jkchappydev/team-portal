package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Size;

// cover: 업로드 이미지(att:{첨부 ID}) 또는 https 이미지 주소 (null이거나 비어 있으면 커버 제거)
public record DocumentCoverRequest(@Size(max = 512) String cover) {
}
