package dev.jkchappy.portal.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

  // 상위 페이지 (null이면 프로젝트 최상위)
  @Column(name = "parent_id")
  private Long parentId;

  public void placeUnder(Long parentId) {
    this.parentId = parentId;
  }

  // 페이지 또는 파일 항목
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private DocumentKind kind = DocumentKind.PAGE;

  // 파일 항목의 파일 본체 (페이지는 null)
  @Column(name = "attachment_id")
  private Long attachmentId;

  public boolean isFile() {
    return kind == DocumentKind.FILE;
  }

  // 업로드한 파일 본체 연결
  public void attachFile(Long attachmentId) {
    this.attachmentId = attachmentId;
  }

  // 사이드바에 끌어다 놓은 파일 항목 (제목은 파일 이름, 아이콘은 확장자별 기본 아이콘)
  public static Document createFile(Long spaceId, String fileName, Long createdBy) {
    Document doc = create(spaceId, fileName, createdBy);
    doc.kind = DocumentKind.FILE;
    doc.icon = FileIcons.forName(fileName);
    return doc;
  }

  // 같은 상위 페이지 안에서의 표시 순서 (작을수록 위)
  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  @Column(nullable = false, length = 200)
  private String title;

  // 제목 앞 아이콘: 이모지, att:{첨부 ID}, https 이미지 주소 (null이면 없음)
  @Column(length = 512)
  private String icon;

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

  // 아이콘 변경 시 수정자와 수정 시각 갱신
  public void changeIcon(String icon, Long userId) {
    this.icon = icon;
    this.updatedBy = userId;
    this.updatedAt = Instant.now();
  }

  // 프로젝트 이름 변경에 맞춘 본문 페이지 제목 동기화 (수정자는 유지)
  public void changeTitle(String title) {
    this.title = title;
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
