package dev.jkchappy.portal.wbs.dto;

import java.time.LocalDate;
import java.util.List;

// WBS 표의 한 줄 (id가 null이면 전체 합계 줄)
// weight·planned·actual 값은 모두 백분율(0~100)
public record WbsRow(
  Long id,
  Long parentId,
  int depth,
  boolean hasChildren,
  String name,
  List<WbsAssignee> assignees,
  LocalDate startDate,
  LocalDate endDate,
  int workdays,
  int calendarDays,
  double weight,
  double plannedTotal,
  double actualTotal,
  double plannedPercent,
  double actualPercent) {

  public record WbsAssignee(Long id, String name) {
  }
}
