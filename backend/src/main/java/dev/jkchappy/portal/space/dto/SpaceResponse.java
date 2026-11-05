package dev.jkchappy.portal.space.dto;

import dev.jkchappy.portal.space.Space;

// icon: 프로젝트 본문 페이지의 이모지 아이콘 (null이면 없음)
public record SpaceResponse(Long id, String name, String description, long documentCount,
  Long homeDocumentId, String icon) {

  public static SpaceResponse from(Space space, long documentCount, String icon) {
    return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), documentCount,
      space.getHomeDocumentId(), icon);
  }
}
