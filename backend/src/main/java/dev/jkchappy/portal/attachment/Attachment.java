package dev.jkchappy.portal.attachment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 문서 첨부파일 메타데이터 (파일 본체는 FileStorage에 저장, 하드 삭제)
@Entity
@Table(name = "attachment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Attachment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "document_id", nullable = false, updatable = false)
  private Long documentId;

  @Column(name = "original_name", nullable = false, length = 255)
  private String originalName;

  @Column(name = "stored_name", nullable = false, unique = true, length = 64)
  private String storedName;

  @Column(name = "content_type", nullable = false, length = 150)
  private String contentType;

  @Column(nullable = false)
  private long size;

  // 편집기 본문 이미지용 업로드 여부 (첨부 목록에서 제외)
  @Column(name = "inline", nullable = false)
  private boolean inline;

  @Column(name = "uploaded_by", nullable = false, updatable = false)
  private Long uploadedBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public static Attachment create(Long documentId, String originalName, String storedName,
    String contentType, long size, boolean inline, Long uploadedBy) {
    Attachment a = new Attachment();
    a.documentId = documentId;
    a.originalName = originalName;
    a.storedName = storedName;
    a.contentType = contentType;
    a.size = size;
    a.inline = inline;
    a.uploadedBy = uploadedBy;
    a.createdAt = Instant.now();
    return a;
  }
}
