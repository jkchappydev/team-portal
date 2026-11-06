package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.DocumentKind;
import jakarta.validation.constraints.Size;

// parentId: 상위 페이지 (없으면 프로젝트 최상위), kind: PAGE 또는 WBS (없으면 PAGE)
public record DocumentCreateRequest(@Size(max = 200) String title, Long parentId, DocumentKind kind) {
}
