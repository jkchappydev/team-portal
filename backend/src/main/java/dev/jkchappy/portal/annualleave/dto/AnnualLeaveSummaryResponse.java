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
  List<WeeklyLeaveUsage> weeklyUsages,
  // 비활성·삭제 팀원은 이월·확정 연차를 고칠 수 없음
  boolean editable
) {
}
