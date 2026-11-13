package dev.jkchappy.portal.workstatus;

import java.time.LocalDate;

// 근무 상황이 바뀌었음을 알리는 이벤트 (label: 바뀐 뒤 표기, 삭제면 지운 항목 표기)
public record WorkStatusChangedEvent(WorkStatusAction action, Long actorId, String label,
  LocalDate startDate, LocalDate endDate) {
}
