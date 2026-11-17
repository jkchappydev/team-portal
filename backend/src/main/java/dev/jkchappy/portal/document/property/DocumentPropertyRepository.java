package dev.jkchappy.portal.document.property;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentPropertyRepository extends JpaRepository<DocumentProperty, Long> {

  // 페이지의 속성을 표시 순서로 (같은 순서면 먼저 만든 것부터)
  List<DocumentProperty> findByDocumentIdOrderBySortOrderAscIdAsc(Long documentId);
}
