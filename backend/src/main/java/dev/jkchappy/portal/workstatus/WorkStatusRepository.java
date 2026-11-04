package dev.jkchappy.portal.workstatus;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkStatusRepository extends JpaRepository<WorkStatus, Long> {

  // 기간이 조회 구간과 겹치는 항목 (월 경계에 걸친 항목 포함)
  @Query("select w from WorkStatus w where w.startDate <= :to and w.endDate >= :from")
  List<WorkStatus> findOverlapping(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
