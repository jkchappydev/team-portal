package dev.jkchappy.portal.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 팀원
@Entity
@Table(name = "member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 50)
  private String name;

  @Column(nullable = false)
  private boolean active = true;

  @Column(nullable = false)
  private boolean admin;

  @Column(length = 100)
  private String department;

  @Enumerated(EnumType.STRING)
  @Column(name = "job_rank", length = 20)
  private JobRank jobRank;

  @Column(name = "sort_order")
  private Long sortOrder;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  // 퇴사 등으로 목록에서 지운 날짜 (행은 남겨 과거 기록의 이름 표시 유지)
  @Column(name = "deleted_on")
  private LocalDate deletedOn;

  public static Member create(String name) {
    Member member = new Member();
    member.name = name;
    member.active = true;
    member.createdAt = Instant.now();
    return member;
  }

  public void rename(String name) {
    this.name = name;
  }

  public void deactivate() {
    this.active = false;
  }

  public void activate() {
    this.active = true;
  }

  public void grantAdmin() {
    this.admin = true;
  }

  public void revokeAdmin() {
    this.admin = false;
  }

  public void setOrganization(String department, JobRank jobRank) {
    this.department = department;
    this.jobRank = jobRank;
  }

  public void changeSortOrder(Long sortOrder) {
    this.sortOrder = sortOrder;
  }

  // 삭제하면 로그인과 관리자 권한도 함께 막음
  public void markDeleted(LocalDate today) {
    this.deletedOn = today;
    this.active = false;
    this.admin = false;
  }

  // 재가입 승인으로 삭제했던 팀원을 다시 살림 (기존 기록이 그대로 이어짐)
  public void restore() {
    this.deletedOn = null;
    this.active = true;
  }

  public boolean isDeleted() {
    return deletedOn != null;
  }
}
