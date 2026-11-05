package dev.jkchappy.portal.holiday;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "holiday")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Holiday {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "holiday_date", nullable = false)
  private LocalDate holidayDate;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "synced_at", nullable = false)
  private Instant syncedAt;

  public static Holiday create(LocalDate holidayDate, String name, Instant syncedAt) {
    Holiday holiday = new Holiday();
    holiday.holidayDate = holidayDate;
    holiday.name = name;
    holiday.syncedAt = syncedAt;
    return holiday;
  }
}
