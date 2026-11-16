package dev.jkchappy.portal.workstatus;

import lombok.Getter;

// 근무 상황 종류 (선언 순서가 하루 안 정렬 순서)
@Getter
public enum WorkStatusType {
  LEAVE("연차"),
  HALF_DAY("반차"),
  QUARTER_DAY("반반차"),
  // 공가(예비군·민방위·경조 등): 쉬는 날이지만 연차에서 빼지 않음 (하루·기간 또는 오전/오후 반차)
  OFFICIAL_LEAVE("공가"),
  BUSINESS_TRIP("출장"),
  OUTSIDE_WORK("외근"),
  OTHER("기타");

  private final String displayName;

  WorkStatusType(String displayName) {
    this.displayName = displayName;
  }
}
