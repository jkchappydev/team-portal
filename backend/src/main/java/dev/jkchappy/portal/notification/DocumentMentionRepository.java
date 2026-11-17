package dev.jkchappy.portal.notification;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

public interface DocumentMentionRepository extends JpaRepository<DocumentMention, DocumentMentionKey> {

  @Query(value = "select member_id from document_mention where document_id = :documentId", nativeQuery = true)
  List<Long> findMemberIds(@Param("documentId") Long documentId);

  // 이미 있으면 처음 언급 정보 유지
  @Modifying
  @Query(value = "insert into document_mention (document_id, member_id, mentioned_by, mentioned_at) "
    + "values (:documentId, :memberId, :mentionedBy, :mentionedAt) on conflict do nothing", nativeQuery = true)
  void insert(@Param("documentId") Long documentId, @Param("memberId") Long memberId,
    @Param("mentionedBy") Long mentionedBy, @Param("mentionedAt") Instant mentionedAt);

  @Modifying
  @Query(value = "delete from document_mention where document_id = :documentId and member_id in :memberIds",
    nativeQuery = true)
  void delete(@Param("documentId") Long documentId, @Param("memberIds") Collection<Long> memberIds);

  // 다른 사람이 언급했고 memberId가 그 뒤로 확인하지 않은 문서 ID (documentIds 중에서)
  @Query(value = "select m.document_id from document_mention m "
    + "left join document_read r on r.document_id = m.document_id and r.member_id = m.member_id "
    + "where m.member_id = :memberId and m.document_id in :documentIds "
    + "and m.mentioned_by is not null and m.mentioned_by <> :memberId "
    + "and (r.read_at is null or r.read_at < m.mentioned_at)", nativeQuery = true)
  List<Long> findUnreadMentionedDocumentIds(@Param("memberId") Long memberId,
    @Param("documentIds") Collection<Long> documentIds);
}
