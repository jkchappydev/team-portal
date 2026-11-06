package dev.jkchappy.portal.wbs;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;

// 작업일(주말·공휴일 제외)과 달력 기간 계산
public final class WbsCalendar {

  private WbsCalendar() {
  }

  public static boolean isWorkday(LocalDate date, Set<LocalDate> holidays) {
    DayOfWeek day = date.getDayOfWeek();
    return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY && !holidays.contains(date);
  }

  // 시작일~완료일(양 끝 포함) 중 작업일 수
  public static int workdays(LocalDate start, LocalDate end, Set<LocalDate> holidays) {
    if (start == null || end == null || end.isBefore(start)) {
      return 0;
    }
    int count = 0;
    for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
      if (isWorkday(d, holidays)) {
        count++;
      }
    }
    return count;
  }

  // 시작일~완료일(양 끝 포함)의 달력 날 수
  public static int calendarDays(LocalDate start, LocalDate end) {
    if (start == null || end == null || end.isBefore(start)) {
      return 0;
    }
    return (int) ChronoUnit.DAYS.between(start, end) + 1;
  }

  // 기준일까지 지났어야 할 진척률 (기준일 당일 포함, 작업일 기준)
  public static double plannedPercent(LocalDate start, LocalDate end, LocalDate baseDate, Set<LocalDate> holidays) {
    if (start == null || end == null || baseDate.isBefore(start)) {
      return 0;
    }
    if (!baseDate.isBefore(end)) {
      return 100;
    }
    int total = workdays(start, end, holidays);
    if (total == 0) {
      return 0;
    }
    return workdays(start, baseDate, holidays) * 100.0 / total;
  }
}
