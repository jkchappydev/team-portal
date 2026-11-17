package dev.jkchappy.portal.space.dto;

import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.space.Space;

// kind: PROJECT(메인 화면 갤러리에 보임) 또는 PAGE, icon·cover: 본문 페이지의 아이콘·커버 (null이면 없음)
public record SpaceResponse(Long id, String name, String description, long documentCount,
  Long homeDocumentId, String kind, String icon, String cover) {

  // home은 본문 페이지 (없으면 null)
  public static SpaceResponse from(Space space, long documentCount, Document home) {
    return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), documentCount,
      space.getHomeDocumentId(), space.getKind().name(),
      home == null ? null : home.getIcon(),
      home == null ? null : home.getCover());
  }
}
