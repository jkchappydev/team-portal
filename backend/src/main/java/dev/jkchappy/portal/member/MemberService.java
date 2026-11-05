package dev.jkchappy.portal.member;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.account.Account;
import dev.jkchappy.portal.account.AccountRepository;
import dev.jkchappy.portal.member.dto.MemberCreateRequest;
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberService {

  private final MemberRepository memberRepository;
  private final AccountRepository accountRepository;
  private final Clock clock;

  // 삭제일은 회사 기준 날짜로 기록
  static final ZoneId PORTAL_ZONE = ZoneId.of("Asia/Seoul");

  // 이름순 조회 (기본은 활성 팀원만, 삭제한 팀원은 항상 제외)
  @Transactional(readOnly = true)
  public List<MemberResponse> findAll(boolean includeInactive) {
    List<Member> members = MemberOrder.sorted(includeInactive
      ? memberRepository.findByDeletedOnIsNullOrderByNameAsc()
      : memberRepository.findByActiveTrueOrderByNameAsc());
    Map<Long, String> emails = new HashMap<>();
    if (!members.isEmpty()) {
      accountRepository.findByMemberIdIn(members.stream().map(Member::getId).toList())
        .forEach(account -> emails.put(account.getMember().getId(), account.getEmail()));
    }
    return members.stream().map(member -> MemberResponse.from(member, emails.get(member.getId()))).toList();
  }

  @Transactional
  public MemberResponse create(MemberCreateRequest request) {
    String name = normalizeName(request.name());
    Member member = Member.create(name);
    MemberOrder.placeNew(member, memberRepository.lockAllForOrder());
    return MemberResponse.from(memberRepository.save(member));
  }

  @Transactional
  public MemberResponse update(Long id, MemberUpdateRequest request) {
    Member member = memberRepository.findById(id)
      .filter(m -> !m.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (request.name() != null) {
      member.rename(normalizeName(request.name()));
    }
    if (request.department() != null || request.jobRank() != null) {
      member.setOrganization(request.department() == null ? member.getDepartment() : normalizeDepartment(request.department()),
        request.jobRank() == null ? member.getJobRank() : request.jobRank());
    }
    // 삭제 대신 비활성화로 과거 작성 이력 보존
    if (request.active() != null) {
      if (request.active()) {
        member.activate();
      } else {
        if (member.isActive() && member.isAdmin() && memberRepository.lockActiveAdmins().size() <= 1) {
          throw new BusinessException(ErrorCode.LAST_ADMIN);
        }
        member.deactivate();
      }
    }
    return MemberResponse.from(member, accountRepository.findByMemberId(id).map(Account::getEmail).orElse(null));
  }

  // 퇴사 등으로 팀원 목록에서 삭제 (행은 남겨 작성 문서·근무 상황·연차 기록과 이름 표시 유지, 로그인은 막힘)
  @Transactional
  public void delete(Long id, Long currentUserId) {
    if (id.equals(currentUserId)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "자기 자신은 삭제할 수 없습니다.");
    }
    List<Member> activeAdmins = memberRepository.lockActiveAdmins();
    Member member = memberRepository.findForUpdateById(id)
      .filter(m -> !m.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (member.isAdmin() && member.isActive() && activeAdmins.size() <= 1) {
      throw new BusinessException(ErrorCode.LAST_ADMIN);
    }
    member.markDeleted(LocalDate.now(clock.withZone(PORTAL_ZONE)));
  }

  // 공동 편집 접속 팀원의 활성 상태 확인
  @Transactional(readOnly = true)
  public Member getActiveMember(Long id) {
    return memberRepository.findById(id)
      .filter(Member::isActive)
      .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_INACTIVE));
  }

  // 작성자 이름 표시용: 비활성 팀원 포함
  @Transactional(readOnly = true)
  public Map<Long, String> findNamesByIds(Collection<Long> ids) {
    Map<Long, String> names = new HashMap<>();
    if (ids.isEmpty()) {
      return names;
    }
    memberRepository.findAllById(ids).forEach(m -> names.put(m.getId(), m.getName()));
    return names;
  }

  @Transactional
  public void move(Long memberId, Long beforeId) {
    List<Member> members = new ArrayList<>(MemberOrder.sorted(memberRepository.lockAllForOrder()));
    Member moving = members.stream().filter(member -> member.getId().equals(memberId)).findFirst()
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (memberId.equals(beforeId)) return;
    members.remove(moving);
    int target = members.size();
    if (beforeId != null) {
      target = -1;
      for (int i = 0; i < members.size(); i++) {
        if (members.get(i).getId().equals(beforeId)) { target = i; break; }
      }
      if (target < 0) throw new BusinessException(ErrorCode.INVALID_INPUT);
    }
    members.add(target, moving);
    for (int i = 0; i < members.size(); i++) members.get(i).changeSortOrder((long) i);
  }

  public static String normalizeDepartment(String department) {
    String value = department == null ? "" : department.trim();
    if (value.isEmpty() || value.length() > 100) throw new BusinessException(ErrorCode.INVALID_INPUT, "부서는 1~100자여야 합니다.");
    return value;
  }

  private String normalizeName(String name) {
    String trimmed = name == null ? "" : name.trim();
    if (trimmed.isEmpty() || trimmed.length() > 50) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이름은 1~50자여야 합니다.");
    }
    return trimmed;
  }
}
