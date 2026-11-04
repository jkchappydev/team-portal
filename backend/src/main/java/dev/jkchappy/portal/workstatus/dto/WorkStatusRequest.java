package dev.jkchappy.portal.workstatus.dto;

import dev.jkchappy.portal.workstatus.HalfDayPeriod;
import dev.jkchappy.portal.workstatus.WorkStatusType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;

public record WorkStatusRequest(
  @NotNull Long memberId,
  @NotNull WorkStatusType type,
  @NotNull LocalDate startDate,
  @NotNull LocalDate endDate,
  HalfDayPeriod halfDayPeriod,
  LocalTime startTime,
  LocalTime endTime,
  @Size(max = 100) String place,
  @Size(max = 100) String content) {
}
