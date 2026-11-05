package dev.jkchappy.portal.account;

import dev.jkchappy.portal.member.Member;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "account")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "google_subject", nullable = false, unique = true, length = 255)
  private String googleSubject;

  @Column(nullable = false, unique = true, length = 320)
  private String email;

  @Column(name = "google_name", nullable = false, length = 100)
  private String googleName;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private AccountStatus status;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "member_id", unique = true)
  private Member member;

  @Column(name = "requested_at", nullable = false)
  private Instant requestedAt;

  @Column(name = "decided_at")
  private Instant decidedAt;

  @Column(name = "decided_by")
  private Long decidedBy;

  public static Account createPending(String googleSubject, String email, String googleName, Instant now) {
    Account account = new Account();
    account.googleSubject = googleSubject;
    account.email = email;
    account.googleName = googleName;
    account.status = AccountStatus.PENDING;
    account.requestedAt = now;
    return account;
  }

  public void approve(Member member, Long decidedBy, Instant now) {
    this.member = member;
    this.status = AccountStatus.APPROVED;
    this.decidedBy = decidedBy;
    this.decidedAt = now;
  }

  public void reject(Long decidedBy, Instant now) {
    this.status = AccountStatus.REJECTED;
    this.decidedBy = decidedBy;
    this.decidedAt = now;
  }

  public void reopen() {
    this.status = AccountStatus.PENDING;
    this.decidedBy = null;
    this.decidedAt = null;
  }

  // 삭제된 팀원이 다시 로그인하면 새 가입 요청으로 되돌림 (이전 팀원 연결은 남겨 승인 시 기록을 다시 이음)
  public void requestRejoin(Instant now) {
    this.status = AccountStatus.PENDING;
    this.requestedAt = now;
    this.decidedBy = null;
    this.decidedAt = null;
  }

  // 삭제된 팀원 계정이 다시 들어오려는 상태인지
  public boolean isRejoinCandidate() {
    return status == AccountStatus.APPROVED && member != null && member.isDeleted();
  }

  // 승인 전 요청에 남아 있는 이전 팀원 (삭제된 팀원 재가입)
  public Member previousMember() {
    return status != AccountStatus.APPROVED && member != null && member.isDeleted() ? member : null;
  }

  // 구글 계정을 새로 만들어 고유 ID가 바뀐 같은 회사 메일
  public void changeSubject(String googleSubject) {
    this.googleSubject = googleSubject;
  }

  public void updateProfile(String email, String googleName) {
    this.email = email;
    this.googleName = googleName;
  }
}
