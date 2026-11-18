package dev.jkchappy.portal.cs.dto;

import java.util.List;

// 신규 CS 목록 (configured: CS 연동 설정 여부, 미설정이면 items는 빈 목록)
public record NewCsListResponse(boolean configured, List<NewCsResponse> items) {
}
