package dev.jkchappy.portal.cs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// CS 시스템 최근 CS API 응답 항목 (createDate: yyyy-MM-dd HH:mm:ss, KST, managerName: 미지정이면 null)
@JsonIgnoreProperties(ignoreUnknown = true)
public record CsBoardItem(
  Long boardKey,
  String boardTitle,
  String groupName,
  String csUserName,
  String managerName,
  String csStatus,
  String csStatusName,
  String createDate) {
}
