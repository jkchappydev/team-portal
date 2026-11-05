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
    Account account = accounts.findByGoogleSubject(profile.subject())
      // 같은 회사 메일로 구글 계정만 새로 만든 경우 기존 계정(과 기록)을 이어 씀
      .or(() -> accounts.findByEmail(profile.email()).map(existing -> {
        existing.changeSubject(profile.subject());
        return existing;
      }))
      .orElse(null);
    if (account == null) {
      return accounts.save(Account.createPending(profile.subject(), profile.email(), profile.name(), Instant.now(clock)));
    }
    account.updateProfile(profile.email(), profile.name());
    requestRejoinIfDeleted(account);
    return account;
  }

  // 삭제된 팀원이 다시 들어오면 처음부터 가입 승인을 받게 함
  private void requestRejoinIfDeleted(Account account) {
    if (account.isRejoinCandidate()) account.requestRejoin(Instant.now(clock));
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
    if (!isAdmin(memberId)) throw new BusinessException(ErrorCode.ADMIN_REQUIRED);
  }

  @Transactional(readOnly = true)
  public boolean isAdmin(Long memberId) {
    return members.findById(memberId).map(m -> m.isActive() && m.isAdmin()).orElse(false);
  }

  // 로그인한 채로 삭제된 경우에도 새로고침하면 재가입 요청으로 바뀜
  @Transactional
  public AuthMeResponse me(String subject) {
    Account account = findBySubject(subject);
    requestRejoinIfDeleted(account);
    Member member = account.getMember();
    return new AuthMeResponse(account.getEmail(), account.getStatus(), member == null ? null : member.getId(),
      member == null ? null : member.getName(), member != null && member.isActive() && member.isAdmin(),
      member != null && member.isActive());
  }

  @Transactional(readOnly = true)
  public List<SignupRequestResponse> listRequests() {
    return accounts.findByStatusInOrderByRequestedAtAsc(List.of(AccountStatus.PENDING, AccountStatus.REJECTED))
      .stream().map(SignupRequestResponse::from).toList();
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
    // 재가입: 이 계정의 이전 팀원이면 삭제했던 팀원을 살려 기존 기록에 다시 연결
    Member previous = account.previousMember();
    if (member.isDeleted() && previous != null && previous.getId().equals(member.getId())) {
      member.restore();
    } else {
      if (!member.isActive()) throw new BusinessException(ErrorCode.INVALID_INPUT);
      if (accounts.findByMemberId(memberId).filter(linked -> !linked.getId().equals(accountId)).isPresent()) {
        throw new BusinessException(ErrorCode.MEMBER_ALREADY_LINKED);
      }
    }
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
    Member member = members.findForUpdateById(id).filter(m -> !m.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
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
