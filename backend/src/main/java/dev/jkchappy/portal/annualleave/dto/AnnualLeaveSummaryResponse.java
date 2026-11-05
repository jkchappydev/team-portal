package dev.jkchappy.portal.annualleave.dto;

import java.math.BigDecimal;
import java.util.List;

public record AnnualLeaveSummaryResponse(
  Long memberId,
  String memberName,
  BigDecimal confirmedDays,
  BigDecimal carriedDays,
  BigDecimal totalDays,
  BigDecimal usedDays,
  BigDecimal remainingDays,
  List<WeeklyLeaveUsage> weeklyUsages
) {
}
