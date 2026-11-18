package dev.jkchappy.portal.form;

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

// 팀 공용 문서 양식 파일 메타데이터 (파일 본체는 FileStorage에 저장, 하드 삭제)
@Entity
@Table(name = "form_template")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FormTemplate {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "original_name", nullable = false, length = 255)
  private String originalName;

  @Column(name = "stored_name", nullable = false, unique = true, length = 64, updatable = false)
  private String storedName;

  @Column(name = "content_type", nullable = false, length = 150)
  private String contentType;

  @Column(nullable = false)
  private long size;

  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(name = "uploaded_by", nullable = false, updatable = false)
  private Long uploadedBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public static FormTemplate create(String originalName, String storedName, String contentType, long size,
    int sortOrder, Long uploadedBy) {
    FormTemplate form = new FormTemplate();
    form.originalName = originalName;
    form.storedName = storedName;
    form.contentType = contentType;
    form.size = size;
    form.sortOrder = sortOrder;
    form.uploadedBy = uploadedBy;
    form.createdAt = Instant.now();
    return form;
  }

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }
}
