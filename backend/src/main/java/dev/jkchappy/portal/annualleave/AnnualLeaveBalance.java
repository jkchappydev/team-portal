package dev.jkchappy.portal.annualleave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "annual_leave_balance", uniqueConstraints =
  @UniqueConstraint(name = "uk_annual_leave_balance_member_year", columnNames = {"member_id", "year"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnnualLeaveBalance {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "member_id", nullable = false)
  private Long memberId;

  @Column(nullable = false)
  private int year;

  @Column(name = "confirmed_days", nullable = false, precision = 6, scale = 2)
  private BigDecimal confirmedDays;

  @Column(name = "carried_days", nullable = false, precision = 6, scale = 2)
  private BigDecimal carriedDays;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static AnnualLeaveBalance create(Long memberId, int year, BigDecimal confirmedDays,
    BigDecimal carriedDays) {
    AnnualLeaveBalance balance = new AnnualLeaveBalance();
    balance.memberId = memberId;
    balance.year = year;
    balance.createdAt = Instant.now();
    balance.change(confirmedDays, carriedDays);
    return balance;
  }

  public void change(BigDecimal confirmedDays, BigDecimal carriedDays) {
    this.confirmedDays = confirmedDays;
    this.carriedDays = carriedDays;
    this.updatedAt = Instant.now();
  }
}
