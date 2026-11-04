package dev.jkchappy.portal.document;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentSnapshotRepository extends JpaRepository<DocumentSnapshot, Long> {

  // 문서의 가장 최근 스냅샷
  Optional<DocumentSnapshot> findFirstByDocumentIdOrderByCreatedAtDesc(Long documentId);
}
