package dev.jkchappy.portal.annualleave.dto;

import java.math.BigDecimal;

// 월·주(달력 기준 1~5주)별 연차 사용 일수
public record WeeklyLeaveUsage(int month, int week, BigDecimal days) {
}
