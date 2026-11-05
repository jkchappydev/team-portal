package dev.jkchappy.portal.holiday;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HolidayCacheService {

  private static final Duration CACHE_DURATION = Duration.ofHours(24);

  private final HolidayRepository holidayRepository;
  private final HolidayMonthSyncRepository syncRepository;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<Holiday> findByMonth(YearMonth yearMonth) {
    return holidayRepository.findByHolidayDateBetweenOrderByHolidayDateAscNameAsc(
      yearMonth.atDay(1), yearMonth.atEndOfMonth());
  }

  @Transactional(readOnly = true)
  public boolean isFresh(YearMonth yearMonth) {
    Instant threshold = clock.instant().minus(CACHE_DURATION);
    return syncRepository.findById(yearMonth.toString())
      .map(sync -> sync.getSyncedAt().isAfter(threshold))
      .orElse(false);
  }

  @Transactional
  public void replace(YearMonth yearMonth, List<HolidayData> data) {
    Instant now = clock.instant();
    holidayRepository.deleteByHolidayDateBetween(yearMonth.atDay(1), yearMonth.atEndOfMonth());
    holidayRepository.saveAll(data.stream()
      .map(item -> Holiday.create(item.date(), item.name(), now))
      .toList());
    syncRepository.save(HolidayMonthSync.create(yearMonth, now));
  }
}
