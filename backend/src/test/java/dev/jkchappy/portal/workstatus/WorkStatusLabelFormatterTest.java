package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class WorkStatusLabelFormatterTest {

  private static WorkStatus ws(WorkStatusType type, String start, String end, HalfDayPeriod period,
    LocalTime st, LocalTime et, String place, String content) {
    return WorkStatus.create(1L, type, LocalDate.parse(start), LocalDate.parse(end), period, st, et,
      place, content, 1L);
  }

  private String f(WorkStatus w) {
    return WorkStatusLabelFormatter.format("홍길동", w);
  }

  @Test
  void leave_singleDay() {
    assertThat(f(ws(WorkStatusType.LEAVE, "2026-11-02", "2026-11-02", null, null, null, null, null)))
      .isEqualTo("홍길동 연차");
  }

  @Test
  void leave_range() {
    assertThat(f(ws(WorkStatusType.LEAVE, "2026-11-02", "2026-11-06", null, null, null, null, null)))
      .isEqualTo("홍길동 연차(11/2~6)");
  }

  @Test
  void halfDay() {
    assertThat(f(ws(WorkStatusType.HALF_DAY, "2026-11-02", "2026-11-02", HalfDayPeriod.PM, null, null,
      null, null))).isEqualTo("홍길동 반차(오후)");
  }

  @Test
  void quarterDay() {
    assertThat(f(ws(WorkStatusType.QUARTER_DAY, "2026-11-02", "2026-11-02", HalfDayPeriod.PM,
      null, null, null, null))).isEqualTo("홍길동 반반차(오후)");
  }

  @Test
  void businessTrip_withRange() {
    assertThat(f(ws(WorkStatusType.BUSINESS_TRIP, "2026-01-20", "2026-01-21", null, null, null,
      "충남교육청도서관", null))).isEqualTo("홍길동 출장(충남교육청도서관, 1/20~21)");
  }

  @Test
  void businessTrip_singleDay() {
    assertThat(f(ws(WorkStatusType.BUSINESS_TRIP, "2026-01-20", "2026-01-20", null, null, null,
      "전남대", null))).isEqualTo("홍길동 출장(전남대)");
  }

  @Test
  void businessTrip_acrossMonths() {
    assertThat(f(ws(WorkStatusType.BUSINESS_TRIP, "2026-10-30", "2026-11-03", null, null, null,
      "일본", null))).isEqualTo("홍길동 출장(일본, 10/30~11/3)");
  }

  @Test
  void outsideWork() {
    assertThat(f(ws(WorkStatusType.OUTSIDE_WORK, "2026-11-02", "2026-11-02", null,
      LocalTime.of(15, 0), LocalTime.of(18, 0), "인천광역시교육청", null)))
      .isEqualTo("홍길동 외근(인천광역시교육청, 15:00~18:00)");
  }

  @Test
  void other_timeOnly() {
    assertThat(f(ws(WorkStatusType.OTHER, "2026-11-02", "2026-11-02", null,
      LocalTime.of(9, 0), LocalTime.of(12, 0), null, "행사준비"))).isEqualTo("홍길동 행사준비(09:00~12:00)");
  }

  @Test
  void other_noDetail() {
    assertThat(f(ws(WorkStatusType.OTHER, "2026-11-02", "2026-11-02", null, null, null, null,
      "행사준비"))).isEqualTo("홍길동 행사준비");
  }

  @Test
  void other_rangeAndTime() {
    assertThat(f(ws(WorkStatusType.OTHER, "2026-11-02", "2026-11-03", null,
      LocalTime.of(9, 0), LocalTime.of(12, 0), null, "행사준비")))
      .isEqualTo("홍길동 행사준비(11/2~3, 09:00~12:00)");
  }
}
