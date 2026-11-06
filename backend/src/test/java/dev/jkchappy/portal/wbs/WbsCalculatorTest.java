package dev.jkchappy.portal.wbs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.jkchappy.portal.wbs.dto.WbsRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

// 참고 양식(경기도사이버도서관 WBS) 숫자와 같은 결과가 나오는지 검증
class WbsCalculatorTest {

  // 2023-06-06 현충일
  private static final Set<LocalDate> HOLIDAYS = Set.of(LocalDate.of(2023, 6, 6));

  private long nextId = 1;

  private WbsTask task(Long parentId, String name, String start, String end, double progress) {
    WbsTask task = WbsTask.create(1L, parentId, name, 1L);
    ReflectionTestUtils.setField(task, "id", nextId++);
    task.change(name, start == null ? null : LocalDate.parse(start), end == null ? null : LocalDate.parse(end),
      BigDecimal.valueOf(progress), List.of(), 1L);
    return task;
  }

  @Test
  void workdays_excludeWeekendsAndHolidays() {
    // 요구사항 정의: 9일 중 주말 2일과 현충일을 빼서 6일
    assertThat(WbsCalendar.workdays(LocalDate.of(2023, 6, 1), LocalDate.of(2023, 6, 9), HOLIDAYS)).isEqualTo(6);
    assertThat(WbsCalendar.calendarDays(LocalDate.of(2023, 6, 1), LocalDate.of(2023, 6, 9))).isEqualTo(9);
    // 회원관리: 13일 중 작업일 9일
    assertThat(WbsCalendar.workdays(LocalDate.of(2023, 6, 15), LocalDate.of(2023, 6, 27), HOLIDAYS)).isEqualTo(9);
    assertThat(WbsCalendar.calendarDays(LocalDate.of(2023, 6, 15), LocalDate.of(2023, 6, 27))).isEqualTo(13);
  }

  @Test
  void plannedPercent_followsBaseDate() {
    LocalDate start = LocalDate.of(2023, 6, 1);
    LocalDate end = LocalDate.of(2023, 6, 9);
    assertThat(WbsCalendar.plannedPercent(start, end, LocalDate.of(2023, 5, 31), HOLIDAYS)).isZero();
    assertThat(WbsCalendar.plannedPercent(start, end, LocalDate.of(2023, 6, 9), HOLIDAYS)).isEqualTo(100);
    // 6/1, 6/2, 6/5 세 작업일 경과 → 3/6
    assertThat(WbsCalendar.plannedPercent(start, end, LocalDate.of(2023, 6, 5), HOLIDAYS)).isEqualTo(50);
  }

  @Test
  void calculate_weightsLeavesAndAggregatesGroups() {
    WbsTask contract = task(null, "계약일", "2023-05-12", "2023-05-12", 100);
    WbsTask group = task(null, "이용자시스템 스토리보드", null, null, 0);
    WbsTask home = task(group.getId(), "홈페이지 스토리보드", "2023-06-08", "2023-06-30", 0);
    WbsTask parcel = task(group.getId(), "도서택배 스토리보드", "2023-07-03", "2023-07-19", 50);

    WbsCalculator.Result result = WbsCalculator.calculate(List.of(contract, group, home, parcel),
      HOLIDAYS, LocalDate.of(2023, 7, 28), Map.of());

    // 세부 작업 작업일 1 + 17 + 13 = 31
    List<WbsRow> rows = result.tasks();
    assertThat(rows).extracting(WbsRow::name)
      .containsExactly("계약일", "이용자시스템 스토리보드", "홈페이지 스토리보드", "도서택배 스토리보드");
    WbsRow groupRow = rows.get(1);
    assertThat(groupRow.hasChildren()).isTrue();
    assertThat(groupRow.startDate()).isEqualTo(LocalDate.of(2023, 6, 8));
    assertThat(groupRow.endDate()).isEqualTo(LocalDate.of(2023, 7, 19));
    // 상위 작업의 작업일은 하위 범위 기준 (양식의 이용자시스템 30일)
    assertThat(groupRow.workdays()).isEqualTo(30);
    assertThat(groupRow.depth()).isZero();
    assertThat(rows.get(2).depth()).isEqualTo(1);
    assertThat(rows.get(2).weight()).isCloseTo(17 * 100.0 / 31, within(0.001));
    assertThat(groupRow.weight()).isCloseTo(30 * 100.0 / 31, within(0.001));
    // 실적(전체) = 도서택배 가중치 × 50%
    assertThat(groupRow.actualTotal()).isCloseTo(13 * 100.0 / 31 * 0.5, within(0.001));
    assertThat(groupRow.actualPercent()).isCloseTo(13 * 50.0 / 30, within(0.001));

    WbsRow summary = result.summary();
    assertThat(summary.weight()).isCloseTo(100, within(0.001));
    assertThat(summary.plannedTotal()).isCloseTo(100, within(0.001));
    assertThat(summary.actualTotal()).isCloseTo((1 * 100.0 + 13 * 50.0) / 31, within(0.001));
  }

  @Test
  void calculate_taskWithoutDates_hasNoWeight() {
    WbsTask dated = task(null, "요구사항 정의", "2023-06-01", "2023-06-09", 0);
    WbsTask undated = task(null, "미정", null, null, 0);

    WbsCalculator.Result result = WbsCalculator.calculate(List.of(dated, undated), HOLIDAYS,
      LocalDate.of(2023, 6, 1), Map.of());

    assertThat(result.tasks().get(0).weight()).isEqualTo(100);
    assertThat(result.tasks().get(1).weight()).isZero();
    assertThat(result.tasks().get(1).workdays()).isZero();
  }

  @Test
  void calculate_mapsAssigneeNames() {
    WbsTask t = task(null, "통계", "2023-06-19", "2023-06-23", 0);
    t.change("통계", t.getStartDate(), t.getEndDate(), BigDecimal.ZERO, List.of(2L, 3L), 1L);

    WbsCalculator.Result result = WbsCalculator.calculate(List.of(t), HOLIDAYS, LocalDate.of(2023, 6, 19),
      Map.of(2L, "한도윤", 3L, "이재구"));

    assertThat(result.tasks().get(0).assignees()).extracting(WbsRow.WbsAssignee::name)
      .containsExactly("한도윤", "이재구");
  }
}
