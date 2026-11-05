package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.workstatus.dto.WorkStatusRequest;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class WorkStatusValidatorTest {

  private final WorkStatusValidator validator = new WorkStatusValidator();

  private static WorkStatusRequest req(WorkStatusType type, String start, String end,
    HalfDayPeriod period, LocalTime st, LocalTime et, String place, String content) {
    return new WorkStatusRequest(1L, type, LocalDate.parse(start), LocalDate.parse(end), period, st,
      et, place, content);
  }

  private void assertInvalid(WorkStatusRequest r) {
    assertThatThrownBy(() -> validator.validate(r))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void halfDay_multiDay_rejected() {
    assertInvalid(req(WorkStatusType.HALF_DAY, "2026-11-02", "2026-11-03", HalfDayPeriod.AM, null,
      null, null, null));
  }

  @Test
  void halfDay_withoutPeriod_rejected() {
    assertInvalid(req(WorkStatusType.HALF_DAY, "2026-11-02", "2026-11-02", null, null, null, null,
      null));
  }

  @Test
  void quarterDay_withoutPeriod_rejected() {
    assertInvalid(req(WorkStatusType.QUARTER_DAY, "2026-11-02", "2026-11-02", null, null, null,
      null, null));
  }

  @Test
  void quarterDay_withPeriod_accepted() {
    assertThatCode(() -> validator.validate(req(WorkStatusType.QUARTER_DAY, "2026-11-02",
      "2026-11-02", HalfDayPeriod.PM, null, null, null, null))).doesNotThrowAnyException();
  }

  @Test
  void outsideWork_withoutPlace_rejected() {
    assertInvalid(req(WorkStatusType.OUTSIDE_WORK, "2026-11-02", "2026-11-02", null,
      LocalTime.of(9, 0), LocalTime.of(10, 0), null, null));
  }

  @Test
  void endBeforeStart_rejected() {
    assertInvalid(req(WorkStatusType.LEAVE, "2026-11-03", "2026-11-02", null, null, null, null, null));
  }

  @Test
  void timeReversed_rejected() {
    assertInvalid(req(WorkStatusType.OUTSIDE_WORK, "2026-11-02", "2026-11-02", null,
      LocalTime.of(18, 0), LocalTime.of(16, 0), "장소", null));
  }

  @Test
  void other_onlyStartTime_rejected() {
    assertInvalid(req(WorkStatusType.OTHER, "2026-11-02", "2026-11-02", null, LocalTime.of(9, 0),
      null, null, "행사"));
  }

  @Test
  void other_withoutContent_rejected() {
    assertInvalid(req(WorkStatusType.OTHER, "2026-11-02", "2026-11-02", null, null, null, null, " "));
  }

  @Test
  void businessTrip_withoutPlace_rejected() {
    assertInvalid(req(WorkStatusType.BUSINESS_TRIP, "2026-11-02", "2026-11-02", null, null, null,
      null, null));
  }

  @Test
  void leave_range_accepted() {
    assertThatCode(() -> validator.validate(req(WorkStatusType.LEAVE, "2026-11-02", "2026-11-06",
      null, null, null, null, null))).doesNotThrowAnyException();
  }
}
