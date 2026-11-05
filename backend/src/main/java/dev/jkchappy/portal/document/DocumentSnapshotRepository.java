package dev.jkchappy.portal.document;

import dev.jkchappy.portal.document.dto.SnapshotMeta;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentSnapshotRepository extends JpaRepository<DocumentSnapshot, Long> {

  // 문서의 가장 최근 스냅샷
  Optional<DocumentSnapshot> findFirstByDocumentIdOrderByCreatedAtDesc(Long documentId);

  // 수정 이력 목록 (본문 제외, 최근순)
  @Query("select new dev.jkchappy.portal.document.dto.SnapshotMeta(s.id, s.createdAt, s.createdBy, s.reason) "
    + "from DocumentSnapshot s where s.documentId = :documentId order by s.createdAt desc, s.id desc")
  List<SnapshotMeta> findMetaByDocumentId(@Param("documentId") Long documentId, Pageable pageable);
}
