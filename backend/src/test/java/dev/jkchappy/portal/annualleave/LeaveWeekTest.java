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

  // 일요일 시작: 일요일은 다음 평일과 같은 주, 토요일은 앞 평일과 같은 주
  @Test
  void weekOfMonth_sundayStartsTheWeek() {
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 7))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 11, 8))).isEqualTo(2);
    // 2026-08-01은 토요일: 평일이 없는 첫 주는 1주로 묶고 8/2(일)~8/7(금)도 1주
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 8, 1))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 8, 2))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 8, 3))).isEqualTo(1);
    assertThat(LeaveWeek.weekOfMonth(LocalDate.of(2026, 8, 9))).isEqualTo(2);
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
