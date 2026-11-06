package dev.jkchappy.portal.annualleave.dto;

import java.math.BigDecimal;
import java.util.List;

// 월·주(달력 기준 1~5주)별 연차 사용 일수와 그 주에 쓴 날짜 목록
public record WeeklyLeaveUsage(int month, int week, BigDecimal days, List<LeaveUsageDay> dates) {

  public WeeklyLeaveUsage(int month, int week, BigDecimal days) {
    this(month, week, days, List.of());
  }
}
