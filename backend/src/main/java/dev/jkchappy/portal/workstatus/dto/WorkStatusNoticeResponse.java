package dev.jkchappy.portal.workstatus.dto;

import dev.jkchappy.portal.workstatus.WorkStatusAction;
import dev.jkchappy.portal.workstatus.WorkStatusNotice;
import java.time.Instant;
import java.time.LocalDate;

// 근무 상황 변경 알림 한 건 (actorName: 바꾼 사람)
public record WorkStatusNoticeResponse(Long id, WorkStatusAction action, String label, LocalDate startDate,
  LocalDate endDate, String actorName, Instant createdAt) {

  public static WorkStatusNoticeResponse from(WorkStatusNotice notice, String actorName) {
    return new WorkStatusNoticeResponse(notice.getId(), notice.getAction(), notice.getLabel(),
      notice.getStartDate(), notice.getEndDate(), actorName, notice.getCreatedAt());
  }
}
