package dev.jkchappy.portal.wbs.dto;

import jakarta.validation.constraints.Min;

// parentId: 새 상위 작업 (없으면 최상위), index: 형제 사이 위치 (없으면 맨 아래)
public record WbsTaskMoveRequest(Long parentId, @Min(0) Integer index) {
}
