package dev.jkchappy.portal.annualleave.dto;

import java.time.LocalDate;

// 연차를 쓴 하루와 종류 (예: 연차, 오전 반차)
public record LeaveUsageDay(LocalDate date, String label) {
}
