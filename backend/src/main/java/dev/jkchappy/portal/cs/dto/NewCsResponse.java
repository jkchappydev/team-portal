package dev.jkchappy.portal.cs.dto;

import java.time.OffsetDateTime;

// 메인 화면 신규 CS 한 줄 (detailUrl: CS 시스템 상세 화면 주소)
public record NewCsResponse(
  Long id,
  String title,
  String groupName,
  String requesterName,
  OffsetDateTime createdAt,
  String detailUrl) {
}
