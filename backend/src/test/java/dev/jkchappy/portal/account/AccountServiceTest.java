package dev.jkchappy.portal.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.account.dto.GoogleProfile;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.JobRank;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {
  @Mock AccountRepository accounts;
  @Mock MemberRepository members;
  AccountService service;

  @BeforeEach
  void setup() { service = new AccountService(accounts, members, Clock.fixed(Instant.parse("2026-11-05T00:00:00Z"), ZoneOffset.UTC)); }

  @Test
  void newLoginCreatesPendingAccount() {
    when(accounts.save(any())).thenAnswer(inv -> inv.getArgument(0));
    Account account = service.registerLogin(new GoogleProfile("sub", "a@example.com", "이름"));
    assertThat(account.getStatus()).isEqualTo(AccountStatus.PENDING);
    assertThat(account.getMember()).isNull();
  }

  @Test
  void pendingAccountCannotAccess() {
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(Account.createPending("sub", "a@example.com", "이름", Instant.now())));
    assertThatThrownBy(() -> service.requireActiveMemberId("sub"))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ACCOUNT_PENDING));
  }

  @Test
  void rejectedAccountCannotAccess() {
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    account.reject(1L, Instant.now());
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(account));
    assertThatThrownBy(() -> service.requireActiveMemberId("sub"))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ACCOUNT_REJECTED));
  }

  @Test
  void inactiveMemberCannotAccess() {
    Member member = Member.create("팀원");
    member.deactivate();
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    account.approve(member, 1L, Instant.now());
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(account));
    assertThatThrownBy(() -> service.requireActiveMemberId("sub"))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.MEMBER_INACTIVE));
  }

  @Test
  void approvalCreatesNamedMember() {
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    when(accounts.findForUpdateById(1L)).thenReturn(Optional.of(account));
    when(members.save(any(Member.class))).thenAnswer(inv -> inv.getArgument(0));
    service.approveAsNewMember(1L, " 홍길동 ", 2L);
    assertThat(account.getStatus()).isEqualTo(AccountStatus.APPROVED);
    assertThat(account.getMember().getName()).isEqualTo("홍길동");
    assertThat(account.getDecidedBy()).isEqualTo(2L);
  }

  @Test
  void approvalStoresDepartmentAndRank() {
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    when(accounts.findForUpdateById(1L)).thenReturn(Optional.of(account));
    when(members.save(any(Member.class))).thenAnswer(inv -> inv.getArgument(0));
    service.approveAsNewMember(1L, "홍길동", 2L, " 개발팀 ", JobRank.RESPONSIBLE);
    assertThat(account.getMember().getDepartment()).isEqualTo("개발팀");
    assertThat(account.getMember().getJobRank()).isEqualTo(JobRank.RESPONSIBLE);
  }

  @Test
  void concurrentUniqueConstraintIsReportedAsAlreadyLinked() {
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    when(accounts.findForUpdateById(1L)).thenReturn(Optional.of(account));
    when(members.findForUpdateById(2L)).thenReturn(Optional.of(Member.create("팀원")));
    when(accounts.saveAndFlush(account)).thenThrow(new DataIntegrityViolationException("중복"));
    assertThatThrownBy(() -> service.approveWithMember(1L, 2L, 3L))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.MEMBER_ALREADY_LINKED));
  }

  @Test
  void alreadyDecidedRequestCannotBeApproved() {
    Account account = Account.createPending("sub", "a@example.com", "이름", Instant.now());
    account.reject(1L, Instant.now());
    when(accounts.findForUpdateById(1L)).thenReturn(Optional.of(account));
    assertThatThrownBy(() -> service.approveWithMember(1L, 2L, 3L))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.REQUEST_ALREADY_DECIDED));
  }

  @Test
  void lastActiveAdminCannotLoseRole() {
    Member member = Member.create("관리자");
    member.grantAdmin();
    when(members.lockActiveAdmins()).thenReturn(List.of(member));
    when(members.findForUpdateById(1L)).thenReturn(Optional.of(member));
    assertThatThrownBy(() -> service.setAdmin(1L, false))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LAST_ADMIN));
  }

  private Account approvedAccount(String sub, String email, long memberId, String name) {
    Member member = Member.create(name);
    ReflectionTestUtils.setField(member, "id", memberId);
    Account account = Account.createPending(sub, email, name, Instant.parse("2026-01-01T00:00:00Z"));
    ReflectionTestUtils.setField(account, "id", 10L);
    account.approve(member, 1L, Instant.parse("2026-01-02T00:00:00Z"));
    return account;
  }

  @Test
  void deletedMemberLoginBecomesRejoinRequest() {
    Account account = approvedAccount("sub", "a@example.com", 2L, "이재구");
    account.getMember().markDeleted(java.time.LocalDate.of(2026, 10, 1));
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(account));

    service.registerLogin(new GoogleProfile("sub", "a@example.com", "이재구"));

    assertThat(account.getStatus()).isEqualTo(AccountStatus.PENDING);
    assertThat(account.getRequestedAt()).isEqualTo(Instant.parse("2026-11-05T00:00:00Z"));
    assertThat(account.previousMember().getId()).isEqualTo(2L);
  }

  @Test
  void activeMemberLoginStaysApproved() {
    Account account = approvedAccount("sub", "a@example.com", 2L, "이재구");
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(account));

    service.registerLogin(new GoogleProfile("sub", "a@example.com", "이재구"));

    assertThat(account.getStatus()).isEqualTo(AccountStatus.APPROVED);
  }

  @Test
  void meAfterDeletionShowsPending() {
    Account account = approvedAccount("sub", "a@example.com", 2L, "이재구");
    account.getMember().markDeleted(java.time.LocalDate.of(2026, 10, 1));
    when(accounts.findByGoogleSubject("sub")).thenReturn(Optional.of(account));

    assertThat(service.me("sub").status()).isEqualTo(AccountStatus.PENDING);
  }

  @Test
  void sameEmailWithNewGoogleSubjectReusesAccount() {
    Account account = approvedAccount("old-sub", "a@example.com", 2L, "이재구");
    account.getMember().markDeleted(java.time.LocalDate.of(2026, 10, 1));
    when(accounts.findByGoogleSubject("new-sub")).thenReturn(Optional.empty());
    when(accounts.findByEmail("a@example.com")).thenReturn(Optional.of(account));

    Account result = service.registerLogin(new GoogleProfile("new-sub", "a@example.com", "이재구"));

    assertThat(result).isSameAs(account);
    assertThat(account.getGoogleSubject()).isEqualTo("new-sub");
    assertThat(account.getStatus()).isEqualTo(AccountStatus.PENDING);
  }

  @Test
  void rejoinApprovalRestoresPreviousMember() {
    Account account = approvedAccount("sub", "a@example.com", 2L, "이재구");
    Member previous = account.getMember();
    previous.markDeleted(java.time.LocalDate.of(2026, 10, 1));
    account.requestRejoin(Instant.parse("2026-11-01T00:00:00Z"));
    when(accounts.findForUpdateById(10L)).thenReturn(Optional.of(account));
    when(members.findForUpdateById(2L)).thenReturn(Optional.of(previous));

    service.approveWithMember(10L, 2L, 1L, "개발팀", JobRank.SENIOR);

    assertThat(account.getStatus()).isEqualTo(AccountStatus.APPROVED);
    assertThat(previous.isDeleted()).isFalse();
    assertThat(previous.isActive()).isTrue();
  }
}
