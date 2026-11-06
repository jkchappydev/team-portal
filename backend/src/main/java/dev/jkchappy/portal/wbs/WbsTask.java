package dev.jkchappy.portal.wbs;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// WBS 문서 안의 작업 (하위 작업이 있으면 날짜·진척률은 하위에서 계산)
@Entity
@Table(name = "wbs_task")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WbsTask {

  public static final String DEFAULT_NAME = "새 작업";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "document_id", nullable = false, updatable = false)
  private Long documentId;

  // 상위 작업 (null이면 최상위)
  @Column(name = "parent_id")
  private Long parentId;

  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(nullable = false, length = 200)
  private String name;

  @Column(name = "start_date")
  private LocalDate startDate;

  @Column(name = "end_date")
  private LocalDate endDate;

  // 실적 진척률 0~100
  @Column(nullable = false, precision = 4, scale = 1)
  private BigDecimal progress = BigDecimal.ZERO;

  @ElementCollection
  @CollectionTable(name = "wbs_task_assignee", joinColumns = @JoinColumn(name = "task_id"))
  @Column(name = "member_id")
  private Set<Long> assigneeIds = new LinkedHashSet<>();

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "updated_by", nullable = false)
  private Long updatedBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static WbsTask create(Long documentId, Long parentId, String name, Long userId) {
    WbsTask task = new WbsTask();
    task.documentId = documentId;
    task.parentId = parentId;
    task.name = name;
    task.createdBy = userId;
    task.updatedBy = userId;
    task.createdAt = Instant.now();
    task.updatedAt = task.createdAt;
    return task;
  }

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  public void placeUnder(Long parentId) {
    this.parentId = parentId;
  }

  // 이름·날짜·진척률·담당자 수정
  public void change(String name, LocalDate startDate, LocalDate endDate, BigDecimal progress,
    Collection<Long> assigneeIds, Long userId) {
    this.name = name;
    this.startDate = startDate;
    this.endDate = endDate;
    this.progress = progress;
    this.assigneeIds.clear();
    this.assigneeIds.addAll(assigneeIds);
    touch(userId);
  }

  // 하위 작업이 생긴 작업은 날짜와 진척률을 하위에서 계산하므로 직접 입력값을 비움
  public void clearSchedule(Long userId) {
    if (startDate == null && endDate == null && progress.signum() == 0) {
      return;
    }
    this.startDate = null;
    this.endDate = null;
    this.progress = BigDecimal.ZERO;
    touch(userId);
  }

  private void touch(Long userId) {
    this.updatedBy = userId;
    this.updatedAt = Instant.now();
  }
}
