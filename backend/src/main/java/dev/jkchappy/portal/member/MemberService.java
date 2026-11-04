package dev.jkchappy.portal.member;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.dto.MemberCreateRequest;
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberService {

  private final MemberRepository memberRepository;

  // 이름순 조회 (기본은 활성 팀원만)
  @Transactional(readOnly = true)
  public List<MemberResponse> findAll(boolean includeInactive) {
    List<Member> members = includeInactive
      ? memberRepository.findAllByOrderByNameAsc()
      : memberRepository.findByActiveTrueOrderByNameAsc();
    return members.stream().map(MemberResponse::from).toList();
  }

  @Transactional
  public MemberResponse create(MemberCreateRequest request) {
    String name = normalizeName(request.name());
    return MemberResponse.from(memberRepository.save(Member.create(name)));
  }

  @Transactional
  public MemberResponse update(Long id, MemberUpdateRequest request) {
    Member member = memberRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (request.name() != null) {
      member.rename(normalizeName(request.name()));
    }
    // 삭제 대신 비활성화로 과거 작성 이력 보존
    if (request.active() != null) {
      if (request.active()) {
        member.activate();
      } else {
        member.deactivate();
      }
    }
    return MemberResponse.from(member);
  }

  // 현재 사용자 검증용: 없거나 비활성이면 사용자 미선택으로 처리
  @Transactional(readOnly = true)
  public Member getActiveMember(Long id) {
    return memberRepository.findById(id)
      .filter(Member::isActive)
      .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_SELECTED));
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

  private String normalizeName(String name) {
    String trimmed = name == null ? "" : name.trim();
    if (trimmed.isEmpty() || trimmed.length() > 50) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이름은 1~50자여야 합니다.");
    }
    return trimmed;
  }
}
