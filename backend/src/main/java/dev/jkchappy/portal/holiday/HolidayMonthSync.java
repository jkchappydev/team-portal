package dev.jkchappy.portal.holiday;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.YearMonth;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "holiday_month_sync")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HolidayMonthSync {

  @Id
  @Column(name = "year_month", length = 7)
  private String yearMonth;

  @Column(name = "synced_at", nullable = false)
  private Instant syncedAt;

  public static HolidayMonthSync create(YearMonth yearMonth, Instant syncedAt) {
    HolidayMonthSync sync = new HolidayMonthSync();
    sync.yearMonth = yearMonth.toString();
    sync.syncedAt = syncedAt;
    return sync;
  }
}
