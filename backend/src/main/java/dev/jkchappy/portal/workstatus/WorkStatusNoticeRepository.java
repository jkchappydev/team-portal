package dev.jkchappy.portal.workstatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

public interface WorkStatusNoticeRepository extends JpaRepository<WorkStatusNotice, Long> {

  // 받는 사람이 아직 확인하지 않은 since 이후 알림, 최근순
  List<WorkStatusNotice> findByRecipientIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDescIdDesc(
    Long recipientId, Instant since, Limit limit);

  Optional<WorkStatusNotice> findByIdAndRecipientId(Long id, Long recipientId);

  @Modifying
  @Query("update WorkStatusNotice n set n.readAt = :now where n.recipientId = :recipientId and n.readAt is null")
  int markAllRead(@Param("recipientId") Long recipientId, @Param("now") Instant now);
}
