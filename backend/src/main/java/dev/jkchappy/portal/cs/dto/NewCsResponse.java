package dev.jkchappy.portal.cs.dto;

import java.time.OffsetDateTime;

// 메인 화면 CS 한 줄 (status: REQS·PROG·FEED·COMP·HOLD, managerName: 미지정이면 null, detailUrl: CS 시스템 상세 화면 주소)
public record NewCsResponse(
  Long id,
  String title,
  String groupName,
  String requesterName,
  String managerName,
  String status,
  String statusName,
  OffsetDateTime createdAt,
  String detailUrl) {
}
