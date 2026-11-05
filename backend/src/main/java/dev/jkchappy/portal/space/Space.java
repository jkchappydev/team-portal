package dev.jkchappy.portal.space;

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

// 문서를 묶는 공간 (소프트 삭제)
@Entity
@Table(name = "space")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Space {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 500)
  private String description;

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  // 프로젝트 본문 페이지 (생성 직후 연결)
  @Column(name = "home_document_id")
  private Long homeDocumentId;

  public void assignHomeDocument(Long documentId) {
    this.homeDocumentId = documentId;
  }

  // 사이드바 표시 순서 (작을수록 위)
  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  public boolean isHomeDocument(Long documentId) {
    return homeDocumentId != null && homeDocumentId.equals(documentId);
  }

  public static Space create(String name, String description, Long createdBy) {
    Space space = new Space();
    space.name = name;
    space.description = description;
    space.createdBy = createdBy;
    space.createdAt = Instant.now();
    space.updatedAt = space.createdAt;
    return space;
  }

  public void change(String name, String description) {
    this.name = name;
    this.description = description;
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
