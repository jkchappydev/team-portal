package dev.jkchappy.portal.link.dto;

import dev.jkchappy.portal.link.SidebarLink;

// icon: 이모지 (없으면 null)
public record LinkResponse(Long id, String title, String url, String icon) {

  public static LinkResponse from(SidebarLink link) {
    return new LinkResponse(link.getId(), link.getTitle(), link.getUrl(), link.getIcon());
  }
}
