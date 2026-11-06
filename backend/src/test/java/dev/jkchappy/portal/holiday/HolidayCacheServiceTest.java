package dev.jkchappy.portal.holiday;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.common.ClockConfig;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

// 읽기 전용 조회(WBS 일정표) 중에 공휴일 캐시를 새로 저장해도 실패하지 않는지 검증
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfig.class, HolidayCacheService.class, ClockConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class HolidayCacheServiceTest {

  @Autowired
  private HolidayCacheService cacheService;

  @Autowired
  private PlatformTransactionManager transactionManager;

  @Test
  void replace_insideReadOnlyTransaction_savesInOwnTransaction() {
    YearMonth june = YearMonth.of(2023, 6);
    TransactionTemplate readOnly = new TransactionTemplate(transactionManager);
    readOnly.setReadOnly(true);

    // 고치기 전에는 "cannot execute INSERT in a read-only transaction"으로 실패
    readOnly.executeWithoutResult(status ->
      cacheService.replace(june, List.of(new HolidayData(LocalDate.of(2023, 6, 6), "현충일"))));

    assertThat(cacheService.findByMonth(june)).extracting(Holiday::getName).containsExactly("현충일");
    assertThat(cacheService.isFresh(june)).isTrue();
  }
}
