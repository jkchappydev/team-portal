package dev.jkchappy.portal.space.dto;

import dev.jkchappy.portal.space.SpaceKind;
import jakarta.validation.constraints.Size;

// 새 최상위 항목 생성 요청 (이름이 비어 있으면 "제목 없음"으로 만들고 화면에서 바로 이름을 입력, kind가 없으면 프로젝트)
public record SpaceCreateRequest(
  @Size(max = 100) String name,
  @Size(max = 500) String description,
  SpaceKind kind) {
}
