package dev.jkchappy.portal.workstatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 받는 사람 한 명에게 보내는 근무 상황 변경 알림
@Entity
@Table(name = "work_status_notice")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkStatusNotice {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recipient_id", nullable = false)
  private Long recipientId;

  @Column(name = "actor_id", nullable = false)
  private Long actorId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private WorkStatusAction action;

  @Column(nullable = false, length = 300)
  private String label;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "read_at")
  private Instant readAt;

  public static WorkStatusNotice of(Long recipientId, WorkStatusChangedEvent event, Instant createdAt) {
    WorkStatusNotice notice = new WorkStatusNotice();
    notice.recipientId = recipientId;
    notice.actorId = event.actorId();
    notice.action = event.action();
    notice.label = event.label();
    notice.startDate = event.startDate();
    notice.endDate = event.endDate();
    notice.createdAt = createdAt;
    return notice;
  }

  public void markRead(Instant at) {
    if (readAt == null) {
      readAt = at;
    }
  }
}
