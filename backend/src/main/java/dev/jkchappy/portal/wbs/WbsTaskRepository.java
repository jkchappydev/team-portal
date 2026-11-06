package dev.jkchappy.portal.wbs;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WbsTaskRepository extends JpaRepository<WbsTask, Long> {

  // WBS 문서의 전체 작업 (같은 순서면 먼저 만든 작업이 위)
  List<WbsTask> findByDocumentIdOrderBySortOrderAscIdAsc(Long documentId);

  // 작업 삭제 (하위 작업과 담당자는 DB의 ON DELETE CASCADE로 함께 삭제)
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("delete from WbsTask t where t.id = :id")
  void deleteWithChildren(@Param("id") Long id);
}
