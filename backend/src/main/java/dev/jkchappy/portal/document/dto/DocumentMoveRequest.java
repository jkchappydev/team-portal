package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Min;

// parentId: 새 상위 페이지 (null이면 프로젝트 최상위)
// index: 새 상위 페이지 안에서 들어갈 위치 (0이 맨 위, 없으면 맨 아래)
public record DocumentMoveRequest(Long parentId, @Min(0) Integer index) {
}
