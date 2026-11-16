package dev.jkchappy.portal.workstatus;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeList;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 근무 상황 등록·수정·삭제를 관리자·개발자 권한 팀원에게 알림 (바꾼 본인은 제외)
@Service
@RequiredArgsConstructor
public class WorkStatusNoticeService {

  // 페이지 수정 알림과 같은 기준: 14일 넘은 알림은 숨기고 최대 30건
  static final Duration LOOKBACK = Duration.ofDays(14);
  static final int MAX_ITEMS = 30;

  private final WorkStatusNoticeRepository noticeRepository;
  private final MemberRepository memberRepository;
  private final MemberService memberService;
  private final Clock clock;

  // 근무 상황 저장과 같은 트랜잭션에서 받는 사람마다 알림을 남김
  @EventListener
  public void onChanged(WorkStatusChangedEvent event) {
    Instant now = clock.instant();
    List<WorkStatusNotice> notices = memberRepository.findWorkStatusNoticeRecipients().stream()
      .map(Member::getId)
      .filter(id -> !id.equals(event.actorId()))
      .map(id -> WorkStatusNotice.of(id, event, now))
      .toList();
    noticeRepository.saveAll(notices);
  }

  @Transactional(readOnly = true)
  public WorkStatusNoticeList findUnread(Long memberId) {
    if (!isRecipient(memberId)) {
      return new WorkStatusNoticeList(false, List.of());
    }
    List<WorkStatusNotice> notices = noticeRepository
      .findByRecipientIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDescIdDesc(
        memberId, clock.instant().minus(LOOKBACK), Limit.of(MAX_ITEMS));
    Map<Long, String> names = memberService.findNamesByIds(
      notices.stream().map(WorkStatusNotice::getActorId).distinct().toList());
    List<WorkStatusNoticeResponse> items = notices.stream()
      .map(n -> WorkStatusNoticeResponse.from(n, names.getOrDefault(n.getActorId(), "")))
      .toList();
    return new WorkStatusNoticeList(true, items);
  }

  // 알림 하나 확인 (다른 사람 알림이면 NOT_FOUND)
  @Transactional
  public void markRead(Long memberId, Long noticeId) {
    noticeRepository.findByIdAndRecipientId(noticeId, memberId)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND))
      .markRead(clock.instant());
  }

  @Transactional
  public void markAllRead(Long memberId) {
    noticeRepository.markAllRead(memberId, clock.instant());
  }

  private boolean isRecipient(Long memberId) {
    return memberRepository.findById(memberId)
      .filter(m -> m.isActive() && m.getDeletedOn() == null)
      .filter(m -> m.isAdmin() || m.isDeveloper())
      .isPresent();
  }
}
