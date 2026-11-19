package dev.jkchappy.portal.document.dto;

import java.time.OffsetDateTime;
import java.util.List;

// kind: space(사이드바 최상위 항목), document(페이지), form(공유 보관함 파일), spaceKind: space일 때 PROJECT 또는 PAGE (그 밖은 null),
// children: 함께 숨겨진 하위 페이지 (깊이 우선 순서, form은 빈 목록)
public record TrashItem(String kind, Long id, String name, String icon, String spaceKind, OffsetDateTime deletedAt,
  List<TrashChild> children) {
}
