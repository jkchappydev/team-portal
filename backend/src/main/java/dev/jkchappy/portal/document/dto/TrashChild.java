package dev.jkchappy.portal.document.dto;

// 상위와 함께 숨겨진 하위 페이지 (depth 1이 바로 아래)
public record TrashChild(Long id, String title, String icon, int depth) {
}
