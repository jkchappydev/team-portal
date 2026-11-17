package dev.jkchappy.portal.document.property;

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

// 페이지 제목 아래 속성 한 줄 (이름·종류·값, 페이지 안에서의 순서)
@Entity
@Table(name = "document_property")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentProperty {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "document_id", nullable = false, updatable = false)
  private Long documentId;

  @Column(nullable = false, length = 50)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private PropertyType type;

  @Column
  private String value;

  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static DocumentProperty create(Long documentId, String name, PropertyType type, String value, int sortOrder) {
    DocumentProperty property = new DocumentProperty();
    property.documentId = documentId;
    property.name = name;
    property.type = type;
    property.value = value;
    property.sortOrder = sortOrder;
    property.createdAt = Instant.now();
    property.updatedAt = property.createdAt;
    return property;
  }

  // 페이지 복제 때 같은 이름·종류·값·순서로 새 페이지에 복사
  public DocumentProperty copyTo(Long documentId) {
    return create(documentId, name, type, value, sortOrder);
  }

  public void rename(String name) {
    this.name = name;
    this.updatedAt = Instant.now();
  }

  public void changeValue(String value) {
    this.value = value;
    this.updatedAt = Instant.now();
  }

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }
}
