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
import java.time.LocalTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 근무 상황 (연차/반차/반반차/출장/외근/기타)
@Entity
@Table(name = "work_status")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkStatus {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "member_id", nullable = false)
  private Long memberId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private WorkStatusType type;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Enumerated(EnumType.STRING)
  @Column(name = "half_day_period", length = 2)
  private HalfDayPeriod halfDayPeriod;

  @Column(name = "start_time")
  private LocalTime startTime;

  @Column(name = "end_time")
  private LocalTime endTime;

  @Column(length = 100)
  private String place;

  @Column(length = 100)
  private String content;

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static WorkStatus create(Long memberId, WorkStatusType type, LocalDate startDate,
    LocalDate endDate, HalfDayPeriod halfDayPeriod, LocalTime startTime, LocalTime endTime,
    String place, String content, Long createdBy) {
    WorkStatus ws = new WorkStatus();
    ws.createdBy = createdBy;
    ws.createdAt = Instant.now();
    ws.change(memberId, type, startDate, endDate, halfDayPeriod, startTime, endTime, place, content);
    return ws;
  }

  // 종류에 쓰지 않는 필드는 저장 전에 비움
  public void change(Long memberId, WorkStatusType type, LocalDate startDate, LocalDate endDate,
    HalfDayPeriod halfDayPeriod, LocalTime startTime, LocalTime endTime, String place,
    String content) {
    this.memberId = memberId;
    this.type = type;
    this.startDate = startDate;
    this.endDate = endDate;
    boolean usesPeriod = type == WorkStatusType.HALF_DAY || type == WorkStatusType.QUARTER_DAY
      || type == WorkStatusType.TEAM_LEAVE;
    this.halfDayPeriod = usesPeriod ? halfDayPeriod : null;
    boolean usesTime = type == WorkStatusType.OUTSIDE_WORK || type == WorkStatusType.OTHER;
    this.startTime = usesTime ? startTime : null;
    this.endTime = usesTime ? endTime : null;
    this.place = type == WorkStatusType.BUSINESS_TRIP || type == WorkStatusType.OUTSIDE_WORK
      ? place : null;
    this.content = type == WorkStatusType.OTHER ? content : null;
    this.updatedAt = Instant.now();
  }
}
