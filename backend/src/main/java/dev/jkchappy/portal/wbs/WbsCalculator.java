package dev.jkchappy.portal.wbs;

import dev.jkchappy.portal.wbs.dto.WbsRow;
import dev.jkchappy.portal.wbs.dto.WbsRow.WbsAssignee;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// 작업 트리의 작업일·가중치·계획·실적 계산
// 가중치는 세부 작업(하위가 없는 작업)의 작업일 비율이고, 상위 작업은 하위 값을 합산
public final class WbsCalculator {

  // 순환 데이터 방어용 최대 깊이
  private static final int MAX_DEPTH = 30;
  private static final Long ROOT_KEY = 0L;

  private final Map<Long, List<WbsTask>> childrenByParent = new LinkedHashMap<>();
  private final Set<LocalDate> holidays;
  private final LocalDate baseDate;
  private final Map<Long, String> memberNames;
  private final List<WbsRow> rows = new ArrayList<>();
  private final Set<Long> visited = new HashSet<>();
  private int totalLeafWorkdays;

  public record Result(WbsRow summary, List<WbsRow> tasks) {
  }

  // 같은 줄에서 상위로 넘기는 합계
  private record Aggregate(LocalDate start, LocalDate end, double weight, double plannedTotal, double actualTotal) {
  }

  private WbsCalculator(List<WbsTask> tasks, Set<LocalDate> holidays, LocalDate baseDate,
    Map<Long, String> memberNames) {
    this.holidays = holidays;
    this.baseDate = baseDate;
    this.memberNames = memberNames;
    // 정렬된 작업 목록을 상위 작업별로 묶음 (상위가 목록에 없으면 최상위로 취급)
    Set<Long> ids = new HashSet<>();
    tasks.forEach(t -> ids.add(t.getId()));
    for (WbsTask task : tasks) {
      Long key = task.getParentId() == null || !ids.contains(task.getParentId()) ? ROOT_KEY : task.getParentId();
      childrenByParent.computeIfAbsent(key, k -> new ArrayList<>()).add(task);
    }
  }

  // tasks는 sortOrder 순서로 정렬된 한 WBS 문서의 전체 작업
  public static Result calculate(List<WbsTask> tasks, Set<LocalDate> holidays, LocalDate baseDate,
    Map<Long, String> memberNames) {
    WbsCalculator calculator = new WbsCalculator(tasks, holidays, baseDate, memberNames);
    calculator.totalLeafWorkdays = calculator.sumLeafWorkdays(ROOT_KEY, 0);
    calculator.visited.clear();
    Aggregate total = calculator.visit(ROOT_KEY, null, 0);
    WbsRow summary = calculator.groupRow(null, null, 0, "전체", List.of(), total);
    return new Result(summary, calculator.rows);
  }

  private int sumLeafWorkdays(Long parentKey, int depth) {
    int sum = 0;
    for (WbsTask task : childrenByParent.getOrDefault(parentKey, List.of())) {
      if (depth > MAX_DEPTH || !visited.add(task.getId())) {
        continue;
      }
      sum += hasChildren(task)
        ? sumLeafWorkdays(task.getId(), depth + 1)
        : WbsCalendar.workdays(task.getStartDate(), task.getEndDate(), holidays);
    }
    return sum;
  }

  // 깊이 우선으로 줄을 추가하고 그 단계의 합계를 돌려줌
  private Aggregate visit(Long parentKey, Long parentId, int depth) {
    LocalDate start = null;
    LocalDate end = null;
    double weight = 0;
    double planned = 0;
    double actual = 0;
    for (WbsTask task : childrenByParent.getOrDefault(parentKey, List.of())) {
      if (depth > MAX_DEPTH || !visited.add(task.getId())) {
        continue;
      }
      Aggregate agg;
      if (hasChildren(task)) {
        int index = rows.size();
        rows.add(null);
        agg = visit(task.getId(), task.getId(), depth + 1);
        rows.set(index, groupRow(task.getId(), parentId, depth, task.getName(), assignees(task), agg));
      } else {
        agg = leaf(task, parentId, depth);
      }
      start = min(start, agg.start());
      end = max(end, agg.end());
      weight += agg.weight();
      planned += agg.plannedTotal();
      actual += agg.actualTotal();
    }
    return new Aggregate(start, end, weight, planned, actual);
  }

  private Aggregate leaf(WbsTask task, Long parentId, int depth) {
    int workdays = WbsCalendar.workdays(task.getStartDate(), task.getEndDate(), holidays);
    double weight = totalLeafWorkdays == 0 ? 0 : workdays * 100.0 / totalLeafWorkdays;
    double plannedPercent = WbsCalendar.plannedPercent(task.getStartDate(), task.getEndDate(), baseDate, holidays);
    double actualPercent = task.getProgress().doubleValue();
    double plannedTotal = weight * plannedPercent / 100;
    double actualTotal = weight * actualPercent / 100;
    rows.add(new WbsRow(task.getId(), parentId, depth, false, task.getName(), assignees(task),
      task.getStartDate(), task.getEndDate(), workdays,
      WbsCalendar.calendarDays(task.getStartDate(), task.getEndDate()),
      weight, plannedTotal, actualTotal, plannedPercent, actualPercent));
    return new Aggregate(task.getStartDate(), task.getEndDate(), weight, plannedTotal, actualTotal);
  }

  // 상위 작업·전체 합계 줄: 날짜는 하위 범위, 작업일·기간은 그 범위 기준, 진척률은 가중 평균
  private WbsRow groupRow(Long id, Long parentId, int depth, String name, List<WbsAssignee> assignees,
    Aggregate agg) {
    double plannedPercent = agg.weight() == 0 ? 0 : agg.plannedTotal() * 100 / agg.weight();
    double actualPercent = agg.weight() == 0 ? 0 : agg.actualTotal() * 100 / agg.weight();
    return new WbsRow(id, parentId, depth, true, name, assignees, agg.start(), agg.end(),
      WbsCalendar.workdays(agg.start(), agg.end(), holidays),
      WbsCalendar.calendarDays(agg.start(), agg.end()),
      agg.weight(), agg.plannedTotal(), agg.actualTotal(), plannedPercent, actualPercent);
  }

  private boolean hasChildren(WbsTask task) {
    return childrenByParent.containsKey(task.getId());
  }

  private List<WbsAssignee> assignees(WbsTask task) {
    return task.getAssigneeIds().stream()
      .map(id -> new WbsAssignee(id, memberNames.getOrDefault(id, "")))
      .toList();
  }

  private static LocalDate min(LocalDate a, LocalDate b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isBefore(b) ? a : b;
  }

  private static LocalDate max(LocalDate a, LocalDate b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isAfter(b) ? a : b;
  }
}
