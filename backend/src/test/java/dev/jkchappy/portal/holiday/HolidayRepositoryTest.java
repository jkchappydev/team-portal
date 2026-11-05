package dev.jkchappy.portal.holiday;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class HolidayRepositoryTest {

  @Autowired
  private HolidayRepository holidayRepository;

  @Test
  void findByMonth_returnsOnlyRequestedRange() {
    holidayRepository.save(Holiday.create(LocalDate.of(2026, 6, 3), "선거일", Instant.EPOCH));
    holidayRepository.save(Holiday.create(LocalDate.of(2026, 7, 17), "제헌절", Instant.EPOCH));

    assertThat(holidayRepository.findByHolidayDateBetweenOrderByHolidayDateAscNameAsc(
      LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)))
      .extracting(Holiday::getName)
      .containsExactly("선거일");
  }
}
