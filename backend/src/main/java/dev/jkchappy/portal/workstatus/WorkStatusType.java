package dev.jkchappy.portal.workstatus;

import lombok.Getter;

// 근무 상황 종류 (선언 순서가 하루 안 정렬 순서)
@Getter
public enum WorkStatusType {
  LEAVE("연차"),
  HALF_DAY("반차"),
  EARLY_LEAVE("조퇴"),
  BUSINESS_TRIP("출장"),
  OUTSIDE_WORK("외근"),
  OTHER(null);

  private final String displayName;

  WorkStatusType(String displayName) {
    this.displayName = displayName;
  }
}
