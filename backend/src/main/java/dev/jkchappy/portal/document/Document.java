package dev.jkchappy.portal.document;

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
import org.hibernate.annotations.DynamicUpdate;

// 공간에 속한 문서 (소프트 삭제)
// 변경된 컬럼만 UPDATE해 제목 수정·삭제와 협업 저장이 서로의 값을 덮어쓰지 않게 함
@Entity
@Table(name = "document")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Document {

  public static final String DEFAULT_TITLE = "제목 없음";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "space_id", nullable = false, updatable = false)
  private Long spaceId;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(name = "content_state")
  private byte[] contentState;

  @Column(name = "plain_text", nullable = false)
  private String plainText;

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "updated_by", nullable = false)
  private Long updatedBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  public static Document create(Long spaceId, String title, Long createdBy) {
    Document doc = new Document();
    doc.spaceId = spaceId;
    doc.title = title;
    doc.plainText = "";
    doc.createdBy = createdBy;
    doc.updatedBy = createdBy;
    doc.createdAt = Instant.now();
    doc.updatedAt = doc.createdAt;
    return doc;
  }

  // 제목 수정 시 수정자와 수정 시각 갱신
  public void rename(String title, Long userId) {
    this.title = title;
    this.updatedBy = userId;
    this.updatedAt = Instant.now();
  }

  // 협업 저장 시 본문 상태, 검색용 평문, 수정자, 수정 시각 갱신
  public void updateContent(byte[] state, String plainText, Long updatedBy) {
    this.contentState = state;
    this.plainText = plainText;
    this.updatedBy = updatedBy;
    this.updatedAt = Instant.now();
  }

  public boolean isDeleted() {
    return deletedAt != null;
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  public void restore() {
    this.deletedAt = null;
  }
}
