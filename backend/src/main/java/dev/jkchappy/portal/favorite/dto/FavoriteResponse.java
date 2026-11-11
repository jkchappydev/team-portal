package dev.jkchappy.portal.favorite.dto;

import dev.jkchappy.portal.document.DocumentKind;

// 즐겨찾기 목록 한 줄
// home: 프로젝트 본문 페이지 여부 (화면 주소가 프로젝트 주소), title: 본문 페이지면 프로젝트 이름
public record FavoriteResponse(Long documentId, Long spaceId, String title, String icon, DocumentKind kind,
  boolean home) {
}
