package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Size;

// parentId: 상위 페이지 (없으면 프로젝트 최상위)
public record DocumentCreateRequest(@Size(max = 200) String title, Long parentId) {
}
