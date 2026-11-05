package dev.jkchappy.portal.holiday;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HolidayServiceTest {

  @Mock
  private HolidayCacheService cacheService;

  @Mock
  private HolidayProvider holidayProvider;

  private HolidayService service() {
    return new HolidayService(cacheService, holidayProvider);
  }

  @Test
  void disabledProvider_returnsCachedDataWithoutSync() {
    YearMonth month = YearMonth.of(2026, 11);
    when(holidayProvider.isEnabled()).thenReturn(false);
    when(cacheService.findByMonth(month)).thenReturn(List.of(
      Holiday.create(LocalDate.of(2026, 11, 1), "공휴일", Instant.EPOCH)));

    assertThat(service().findByMonth(month)).extracting("name").containsExactly("공휴일");
    verify(holidayProvider, never()).fetch(month);
  }

  @Test
  void staleCache_fetchesAndReplacesMonth() {
    YearMonth month = YearMonth.of(2026, 6);
    List<HolidayData> fetched = List.of(
      new HolidayData(LocalDate.of(2026, 6, 3), "전국동시지방선거"));
    when(holidayProvider.isEnabled()).thenReturn(true);
    when(cacheService.isFresh(month)).thenReturn(false);
    when(holidayProvider.fetch(month)).thenReturn(fetched);
    when(cacheService.findByMonth(month)).thenReturn(List.of(
      Holiday.create(LocalDate.of(2026, 6, 3), "전국동시지방선거", Instant.EPOCH)));

    assertThat(service().findByMonth(month)).extracting("name")
      .containsExactly("전국동시지방선거");
    verify(cacheService).replace(month, fetched);
  }

  @Test
  void providerFailure_returnsExistingCache() {
    YearMonth month = YearMonth.of(2026, 6);
    when(holidayProvider.isEnabled()).thenReturn(true);
    when(cacheService.isFresh(month)).thenReturn(false);
    when(holidayProvider.fetch(month)).thenThrow(new IllegalStateException("외부 장애"));
    when(cacheService.findByMonth(month)).thenReturn(List.of(
      Holiday.create(LocalDate.of(2026, 6, 3), "캐시된 선거일", Instant.EPOCH)));

    assertThat(service().findByMonth(month)).extracting("name").containsExactly("캐시된 선거일");
  }
}
