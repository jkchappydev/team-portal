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
}
