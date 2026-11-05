package dev.jkchappy.portal.annualleave;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class LeaveWeekTest {

  // 2026-11-01은 일요일: 평일이 시작되는 11/2(월) 주가 1주
  @Test
  void weekOfMonth_monthStartingOnSunday_firstWeekdayWeekIsWeek1() {
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 2))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 6))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 9))).isEqualTo(2);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 30))).isEqualTo(5);
  }

  // 2026-10-01은 목요일: 10/1~2가 1주, 10/5(월)부터 2주
  @Test
  void weekOfMonth_monthStartingMidWeek_partialFirstWeekIsWeek1() {
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 10, 1))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 10, 2))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 10, 5))).isEqualTo(2);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 10, 30))).isEqualTo(5);
  }

  // 평일이 없는 앞쪽 주말은 1주로 묶음
  @Test
  void weekOfMonth_weekendBeforeFirstWeekday_isWeek1() {
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 1))).isEqualTo(1);
  }

  // 평일 기준 주는 어느 달이든 5주를 넘지 않음
  @Test
  void weekOfMonth_neverExceedsFiveForWeekdays() {
    LocalDate date = LocalDate.of(2020, 1, 1);
    while (date.getYear() < 2031) {
      if (date.getDayOfWeek().getValue() <= 5) {
        assertThat(LeaveWeek.weekOfMonth(date)).isBetween(1, 5);
      }
      date = date.plusDays(1);
    }
  }
}
