package dev.jkchappy.portal.attachment;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

  // 영구 삭제하는 페이지들의 첨부 전체 (본문 이미지 포함)
  List<Attachment> findByDocumentIdIn(Collection<Long> documentIds);

  // 영구 삭제하는 페이지들의 첨부 행 일괄 삭제
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("delete from Attachment a where a.documentId in :ids")
  void deleteByDocumentIds(@Param("ids") Collection<Long> ids);

  // 본문 이미지(inline)를 제외한 첨부 목록을 최신순으로 조회
  List<Attachment> findByDocumentIdAndInlineFalseOrderByCreatedAtDesc(Long documentId);
}
