package dev.jkchappy.portal.workstatus.dto;

import java.util.List;

// 근무 상황 변경 알림 목록 (enabled: 알림을 받는 팀원인지, 아니면 화면에서 칸을 숨김)
public record WorkStatusNoticeList(boolean enabled, List<WorkStatusNoticeResponse> items) {
}
