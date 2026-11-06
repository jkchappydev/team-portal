package dev.jkchappy.portal.holiday;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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

  // 읽기 전용 조회(WBS 일정표 등) 중에 불려도 캐시를 저장할 수 있게 별도 트랜잭션으로 커밋
  // 저장이 실패해도 호출한 쪽 트랜잭션은 롤백 대상으로 표시되지 않음
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void replace(YearMonth yearMonth, List<HolidayData> data) {
    Instant now = clock.instant();
    holidayRepository.deleteByHolidayDateBetween(yearMonth.atDay(1), yearMonth.atEndOfMonth());
    holidayRepository.saveAll(data.stream()
      .map(item -> Holiday.create(item.date(), item.name(), now))
      .toList());
    syncRepository.save(HolidayMonthSync.create(yearMonth, now));
  }
}
