package dev.jkchappy.portal.holiday;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {

  List<Holiday> findByHolidayDateBetweenOrderByHolidayDateAscNameAsc(LocalDate start, LocalDate end);

  void deleteByHolidayDateBetween(LocalDate start, LocalDate end);
}
