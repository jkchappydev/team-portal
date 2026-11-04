package dev.jkchappy.portal.workstatus.dto;

import dev.jkchappy.portal.workstatus.HalfDayPeriod;
import dev.jkchappy.portal.workstatus.WorkStatus;
import dev.jkchappy.portal.workstatus.WorkStatusLabelFormatter;
import dev.jkchappy.portal.workstatus.WorkStatusType;
import java.time.LocalDate;
import java.time.LocalTime;

public record WorkStatusResponse(
  Long id,
  Long memberId,
  String memberName,
  WorkStatusType type,
  LocalDate startDate,
  LocalDate endDate,
  HalfDayPeriod halfDayPeriod,
  LocalTime startTime,
  LocalTime endTime,
  String place,
  String content,
  String label) {

  public static WorkStatusResponse from(WorkStatus ws, String memberName) {
    return new WorkStatusResponse(ws.getId(), ws.getMemberId(), memberName, ws.getType(),
      ws.getStartDate(), ws.getEndDate(), ws.getHalfDayPeriod(), ws.getStartTime(), ws.getEndTime(),
      ws.getPlace(), ws.getContent(), WorkStatusLabelFormatter.format(memberName, ws));
  }
}
