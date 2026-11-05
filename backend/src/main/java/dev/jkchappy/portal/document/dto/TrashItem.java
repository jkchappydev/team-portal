package dev.jkchappy.portal.document.dto;

import java.time.OffsetDateTime;
import java.util.List;

// kind: space(프로젝트) 또는 document(페이지), children: 함께 숨겨진 하위 페이지 (깊이 우선 순서)
public record TrashItem(String kind, Long id, String name, String icon, OffsetDateTime deletedAt,
  List<TrashChild> children) {
}
