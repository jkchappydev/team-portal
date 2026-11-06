package dev.jkchappy.portal.wbs.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// 작업 전체 값 저장 (하위 작업이 있는 작업은 날짜·진척률을 비워서 보냄)
public record WbsTaskUpdateRequest(
  @NotBlank @Size(max = 200) String name,
  LocalDate startDate,
  LocalDate endDate,
  @DecimalMin("0") @DecimalMax("100") BigDecimal progress,
  @Size(max = 50) List<Long> assigneeIds) {
}
