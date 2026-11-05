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

  public void updateProfile(String email, String googleName) {
    this.email = email;
    this.googleName = googleName;
  }
}
