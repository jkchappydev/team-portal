package dev.jkchappy.portal.annualleave.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AnnualLeaveBalanceRequest(
  @NotNull @DecimalMin("0.0") @Digits(integer = 4, fraction = 2) BigDecimal confirmedDays,
  @NotNull @DecimalMin("0.0") @Digits(integer = 4, fraction = 2) BigDecimal carriedDays
) {
}
