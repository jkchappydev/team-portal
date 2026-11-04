package dev.jkchappy.portal.workstatus;

import lombok.Getter;

// 반차 구분
@Getter
public enum HalfDayPeriod {
  AM("오전"),
  PM("오후");

  private final String displayName;

  HalfDayPeriod(String displayName) {
    this.displayName = displayName;
  }
}
