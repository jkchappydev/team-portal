package dev.jkchappy.portal.cs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// CS 시스템 신규 CS API 응답 항목 (createDate: yyyy-MM-dd HH:mm:ss, KST)
@JsonIgnoreProperties(ignoreUnknown = true)
public record CsBoardItem(Long boardKey, String boardTitle, String groupName, String csUserName, String createDate) {
}
