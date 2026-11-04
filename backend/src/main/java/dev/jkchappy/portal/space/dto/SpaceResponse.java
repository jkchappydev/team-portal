package dev.jkchappy.portal.space.dto;

import dev.jkchappy.portal.space.Space;

public record SpaceResponse(Long id, String name, String description, long documentCount) {

  public static SpaceResponse from(Space space, long documentCount) {
    return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), documentCount);
  }
}
