package dev.jkchappy.portal.wbs.dto;

import dev.jkchappy.portal.holiday.dto.HolidayResponse;
import java.time.LocalDate;
import java.util.List;

// WBS 화면 데이터: 표시 순서대로 펼친 작업 줄, 전체 합계, 간트 차트 날짜 범위와 그 범위의 공휴일
public record WbsResponse(
  Long documentId,
  LocalDate baseDate,
  WbsRow summary,
  List<WbsRow> tasks,
  LocalDate rangeStart,
  LocalDate rangeEnd,
  List<HolidayResponse> holidays) {
}
