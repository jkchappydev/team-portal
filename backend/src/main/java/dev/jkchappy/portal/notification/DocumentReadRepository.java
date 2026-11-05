package dev.jkchappy.portal.notification;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentReadRepository extends JpaRepository<DocumentRead, DocumentReadKey> {

  // 확인 시각 저장 (이미 있으면 덮어씀, 동시 요청에도 한 행만 유지)
  @Modifying
  @Query(value = "insert into document_read (member_id, document_id, read_at) "
    + "values (:memberId, :documentId, :readAt) "
    + "on conflict (member_id, document_id) do update set read_at = excluded.read_at", nativeQuery = true)
  void upsert(@Param("memberId") Long memberId, @Param("documentId") Long documentId,
    @Param("readAt") Instant readAt);
}
