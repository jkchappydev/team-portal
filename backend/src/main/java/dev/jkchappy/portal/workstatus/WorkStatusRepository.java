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

  @Query("select w from WorkStatus w where w.type in "
    + "(dev.jkchappy.portal.workstatus.WorkStatusType.LEAVE, "
    + "dev.jkchappy.portal.workstatus.WorkStatusType.HALF_DAY, "
    + "dev.jkchappy.portal.workstatus.WorkStatusType.QUARTER_DAY, "
    + "dev.jkchappy.portal.workstatus.WorkStatusType.OFFICIAL_LEAVE, "
    + "dev.jkchappy.portal.workstatus.WorkStatusType.OTHER) "
    + "and w.startDate <= :to and w.endDate >= :from")
  List<WorkStatus> findLeaveOverlapping(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
