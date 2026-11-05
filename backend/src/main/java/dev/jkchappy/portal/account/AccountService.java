package dev.jkchappy.portal.account;

import dev.jkchappy.portal.account.dto.AuthMeResponse;
import dev.jkchappy.portal.account.dto.GoogleProfile;
import dev.jkchappy.portal.account.dto.SignupRequestResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.member.MemberOrder;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.dto.MemberResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountService {
  private final AccountRepository accounts;
  private final MemberRepository members;
  private final Clock clock;

  @Transactional
  public Account registerLogin(GoogleProfile profile) {
    Account account = accounts.findByGoogleSubject(profile.subject()).orElse(null);
    if (account == null) {
      return accounts.save(Account.createPending(profile.subject(), profile.email(), profile.name(), Instant.now(clock)));
    }
    account.updateProfile(profile.email(), profile.name());
    return account;
  }

  @Transactional(readOnly = true)
  public Long requireActiveMemberId(String subject) {
    Account account = findBySubject(subject);
    if (account.getStatus() == AccountStatus.PENDING) throw new BusinessException(ErrorCode.ACCOUNT_PENDING);
    if (account.getStatus() == AccountStatus.REJECTED) throw new BusinessException(ErrorCode.ACCOUNT_REJECTED);
    Member member = account.getMember();
    if (member == null || !member.isActive()) throw new BusinessException(ErrorCode.MEMBER_INACTIVE);
    return member.getId();
  }

  @Transactional(readOnly = true)
  public void requireAdmin(Long memberId) {
    Member member = members.findById(memberId).orElseThrow(() -> new BusinessException(ErrorCode.ADMIN_REQUIRED));
    if (!member.isActive() || !member.isAdmin()) throw new BusinessException(ErrorCode.ADMIN_REQUIRED);
  }

  @Transactional(readOnly = true)
  public AuthMeResponse me(String subject) {
    Account account = findBySubject(subject);
    Member member = account.getMember();
    return new AuthMeResponse(account.getEmail(), account.getStatus(), member == null ? null : member.getId(),
      member == null ? null : member.getName(), member != null && member.isActive() && member.isAdmin());
  }

  @Transactional(readOnly = true)
  public List<SignupRequestResponse> listRequests() {
    return accounts.findByStatusInOrderByRequestedAtAsc(List.of(AccountStatus.PENDING, AccountStatus.REJECTED))
      .stream().map(a -> new SignupRequestResponse(a.getId(), a.getEmail(), a.getGoogleName(), a.getStatus(), a.getRequestedAt())).toList();
  }

  @Transactional(readOnly = true)
  public long countPending() { return accounts.countByStatus(AccountStatus.PENDING); }

  @Transactional
  public void approveWithMember(Long accountId, Long memberId, Long adminId) {
    approveWithMember(accountId, memberId, adminId, null, null);
  }

  @Transactional
  public void approveWithMember(Long accountId, Long memberId, Long adminId, String department, JobRank jobRank) {
    Account account = pending(accountId);
    Member member = members.findForUpdateById(memberId).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (!member.isActive()) throw new BusinessException(ErrorCode.INVALID_INPUT);
    if (accounts.existsByMemberId(memberId)) throw new BusinessException(ErrorCode.MEMBER_ALREADY_LINKED);
    if (department != null && jobRank != null) member.setOrganization(MemberService.normalizeDepartment(department), jobRank);
    account.approve(member, adminId, Instant.now(clock));
    try {
      accounts.saveAndFlush(account);
    } catch (DataIntegrityViolationException e) {
      throw new BusinessException(ErrorCode.MEMBER_ALREADY_LINKED);
    }
  }

  @Transactional
  public void approveAsNewMember(Long accountId, String name, Long adminId) {
    approveAsNewMember(accountId, name, adminId, null, null);
  }

  @Transactional
  public void approveAsNewMember(Long accountId, String name, Long adminId, String department, JobRank jobRank) {
    Account account = pending(accountId);
    String trimmed = name == null ? "" : name.trim();
    if (trimmed.isEmpty() || trimmed.length() > 50) throw new BusinessException(ErrorCode.INVALID_INPUT);
    Member member = Member.create(trimmed);
    if (department != null && jobRank != null) member.setOrganization(MemberService.normalizeDepartment(department), jobRank);
    MemberOrder.placeNew(member, members.lockAllForOrder());
    account.approve(members.save(member), adminId, Instant.now(clock));
  }

  @Transactional
  public void reject(Long id, Long adminId) { pending(id).reject(adminId, Instant.now(clock)); }

  @Transactional
  public void reopen(Long id) {
    Account account = accounts.findForUpdateById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (account.getStatus() != AccountStatus.REJECTED) throw new BusinessException(ErrorCode.REQUEST_ALREADY_DECIDED);
    account.reopen();
  }

  @Transactional
  public MemberResponse setAdmin(Long id, boolean admin) {
    List<Member> activeAdmins = members.lockActiveAdmins();
    Member member = members.findForUpdateById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (!admin && member.isAdmin() && member.isActive() && activeAdmins.size() <= 1) throw new BusinessException(ErrorCode.LAST_ADMIN);
    if (admin) member.grantAdmin(); else member.revokeAdmin();
    return MemberResponse.from(member, accounts.findByMemberId(id).map(Account::getEmail).orElse(null));
  }

  private Account pending(Long id) {
    Account account = accounts.findForUpdateById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (account.getStatus() != AccountStatus.PENDING) throw new BusinessException(ErrorCode.REQUEST_ALREADY_DECIDED);
    return account;
  }

  private Account findBySubject(String subject) {
    return accounts.findByGoogleSubject(subject).orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));
  }
}
