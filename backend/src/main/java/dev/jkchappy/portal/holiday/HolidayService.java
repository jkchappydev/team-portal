package dev.jkchappy.portal.holiday;

import dev.jkchappy.portal.holiday.dto.HolidayResponse;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class HolidayService {

  private final HolidayCacheService cacheService;
  private final HolidayProvider holidayProvider;

  public List<HolidayResponse> findByMonth(YearMonth yearMonth) {
    if (holidayProvider.isEnabled() && !cacheService.isFresh(yearMonth)) {
      try {
        cacheService.replace(yearMonth, holidayProvider.fetch(yearMonth));
      } catch (RuntimeException e) {
        log.warn("공휴일 동기화 실패: {}", yearMonth, e);
      }
    }
    return cacheService.findByMonth(yearMonth).stream().map(HolidayResponse::from).toList();
  }
}
