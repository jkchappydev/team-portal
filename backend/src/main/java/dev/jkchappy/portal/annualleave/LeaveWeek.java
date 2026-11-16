package dev.jkchappy.portal.annualleave;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;

// 달력 기준 월 주차 계산 (근무 상황표 달력과 같이 일요일 시작, 그 달 평일이 처음 나오는 주가 1주)
public final class LeaveWeek {

  private LeaveWeek() {
  }

  public static int weekOfMonth(LocalDate date) {
    LocalDate firstWeekday = date.withDayOfMonth(1);
    while (isWeekend(firstWeekday)) {
      firstWeekday = firstWeekday.plusDays(1);
    }
    LocalDate firstSunday = firstWeekday.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    LocalDate sunday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    long week = ChronoUnit.WEEKS.between(firstSunday, sunday) + 1;
    // 평일 전의 주말(예: 1일이 토요일)은 1주로 묶음
    return (int) Math.max(1, week);
  }

  public static boolean isWeekend(LocalDate date) {
    return date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY;
  }
}
