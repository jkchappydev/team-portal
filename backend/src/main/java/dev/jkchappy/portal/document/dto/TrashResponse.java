package dev.jkchappy.portal.document.dto;

import java.util.List;

// 삭제된 프로젝트와 페이지를 최근 삭제순으로 함께 담은 목록
public record TrashResponse(List<TrashItem> items) {
}
