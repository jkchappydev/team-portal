package dev.jkchappy.portal.workstatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

// 근무 상황 표기 문자열 생성 (예: 홍길동 출장(전남대, 1/20~21))
public final class WorkStatusLabelFormatter {

  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

  private WorkStatusLabelFormatter() {
  }

  public static String format(String memberName, WorkStatus ws) {
    WorkStatusType type = ws.getType();
    String title = type == WorkStatusType.OTHER ? ws.getContent() : type.getDisplayName();

    // 종류별로 괄호 안 항목 순서가 다름
    List<String> details = new ArrayList<>();
    switch (type) {
      case LEAVE -> addIfPresent(details, period(ws));
      case HALF_DAY -> {
        if (ws.getHalfDayPeriod() != null) {
          details.add(ws.getHalfDayPeriod().getDisplayName());
        }
      }
      case QUARTER_DAY -> {
        if (ws.getHalfDayPeriod() != null) {
          details.add(ws.getHalfDayPeriod().getDisplayName());
        }
      }
      case BUSINESS_TRIP -> {
        addIfPresent(details, ws.getPlace());
        addIfPresent(details, period(ws));
      }
      case OUTSIDE_WORK -> {
        addIfPresent(details, ws.getPlace());
        addIfPresent(details, time(ws));
      }
      case OTHER -> {
        addIfPresent(details, period(ws));
        addIfPresent(details, time(ws));
      }
    }

    String label = memberName + " " + title;
    return details.isEmpty() ? label : label + "(" + String.join(", ", details) + ")";
  }

  private static void addIfPresent(List<String> details, String value) {
    if (value != null && !value.isBlank()) {
      details.add(value);
    }
  }

  // 하루면 생략, 같은 달이면 11/11~17, 다른 달이면 10/30~11/3
  private static String period(WorkStatus ws) {
    LocalDate start = ws.getStartDate();
    LocalDate end = ws.getEndDate();
    if (start.equals(end)) {
      return null;
    }
    String startText = start.getMonthValue() + "/" + start.getDayOfMonth();
    if (start.getYear() == end.getYear() && start.getMonth() == end.getMonth()) {
      return startText + "~" + end.getDayOfMonth();
    }
    return startText + "~" + end.getMonthValue() + "/" + end.getDayOfMonth();
  }

  private static String time(WorkStatus ws) {
    LocalTime start = ws.getStartTime();
    LocalTime end = ws.getEndTime();
    if (start == null || end == null) {
      return null;
    }
    return start.format(TIME) + "~" + end.format(TIME);
  }
}
