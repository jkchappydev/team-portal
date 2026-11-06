package dev.jkchappy.portal.space.dto;

import jakarta.validation.constraints.Size;

// 새 최상위 페이지 생성 요청 (이름이 비어 있으면 "제목 없음"으로 만들고 화면에서 바로 이름을 입력)
public record SpaceCreateRequest(
  @Size(max = 100) String name,
  @Size(max = 500) String description) {
}
