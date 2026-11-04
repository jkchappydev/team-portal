package dev.jkchappy.portal.attachment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

  // 본문 이미지(inline)를 제외한 첨부 목록을 최신순으로 조회
  List<Attachment> findByDocumentIdAndInlineFalseOrderByCreatedAtDesc(Long documentId);
}
