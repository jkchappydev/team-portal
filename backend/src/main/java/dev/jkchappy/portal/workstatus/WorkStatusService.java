package dev.jkchappy.portal.workstatus;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.live.LiveUpdateEvent;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.workstatus.dto.WorkStatusRequest;
import dev.jkchappy.portal.workstatus.dto.WorkStatusResponse;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkStatusService {

  private final WorkStatusRepository workStatusRepository;
  private final MemberRepository memberRepository;
  private final MemberService memberService;
  private final WorkStatusValidator validator;
  private final ApplicationEventPublisher events;

  // 월과 겹치는 항목을 종류 순서, 이름 순으로 조회
  @Transactional(readOnly = true)
  public List<WorkStatusResponse> findByMonth(YearMonth month) {
    List<WorkStatus> items = workStatusRepository.findOverlapping(month.atDay(1), month.atEndOfMonth());
    // 비활성 팀원 이름도 표시
    Map<Long, String> names = memberService.findNamesByIds(
      items.stream().map(WorkStatus::getMemberId).distinct().toList());
    return items.stream()
      .map(ws -> WorkStatusResponse.from(ws, names.getOrDefault(ws.getMemberId(), "")))
      .sorted(Comparator.comparing(WorkStatusResponse::type)
        .thenComparing(WorkStatusResponse::memberName)
        .thenComparing(WorkStatusResponse::startDate))
      .toList();
  }

  @Transactional
  public WorkStatusResponse create(WorkStatusRequest request, Long currentUserId) {
    validator.validate(request);
    requireCanManage(currentUserId, request.memberId());
    Member target = getActiveTarget(request.memberId());
    WorkStatus saved = workStatusRepository.save(WorkStatus.create(request.memberId(), request.type(),
      request.startDate(), request.endDate(), request.halfDayPeriod(), request.startTime(),
      request.endTime(), request.place(), request.content(), currentUserId));
    publishChanged(WorkStatusAction.CREATED, saved, target.getName(), currentUserId);
    return WorkStatusResponse.from(saved, target.getName());
  }

  @Transactional
  public WorkStatusResponse update(Long id, WorkStatusRequest request, Long currentUserId) {
    WorkStatus ws = workStatusRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    // 원래 대상자와 바꿀 대상자 모두 다룰 수 있어야 함
    requireCanManage(currentUserId, ws.getMemberId());
    requireCanManage(currentUserId, request.memberId());
    validator.validate(request);
    Member target = getActiveTarget(request.memberId());
    ws.change(request.memberId(), request.type(), request.startDate(), request.endDate(),
      request.halfDayPeriod(), request.startTime(), request.endTime(), request.place(),
      request.content());
    publishChanged(WorkStatusAction.UPDATED, ws, target.getName(), currentUserId);
    return WorkStatusResponse.from(ws, target.getName());
  }

  @Transactional
  public void delete(Long id, Long currentUserId) {
    WorkStatus ws = workStatusRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    requireCanManage(currentUserId, ws.getMemberId());
    String memberName = memberService.findNamesByIds(List.of(ws.getMemberId())).getOrDefault(ws.getMemberId(), "");
    workStatusRepository.delete(ws);
    publishChanged(WorkStatusAction.DELETED, ws, memberName, currentUserId);
  }

  // 근무 상황표를 열어 둔 다른 화면에 변경 알림 (저장 확정 후 전송), 팀장 이상에게 남길 변경 알림
  private void publishChanged(WorkStatusAction action, WorkStatus ws, String memberName, Long actorId) {
    events.publishEvent(new LiveUpdateEvent(LiveUpdateEvent.WORK_STATUS));
    events.publishEvent(new WorkStatusChangedEvent(action, actorId,
      WorkStatusLabelFormatter.format(memberName, ws), ws.getStartDate(), ws.getEndDate()));
  }

  // 본인 근무 상황은 누구나, 다른 팀원 것은 관리자·개발자만 등록·수정·삭제
  private void requireCanManage(Long currentUserId, Long memberId) {
    if (currentUserId.equals(memberId)) return;
    boolean manager = memberRepository.findById(currentUserId)
      .filter(Member::isActive)
      .map(m -> m.isAdmin() || m.isDeveloper())
      .orElse(false);
    if (!manager) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "다른 팀원의 근무 상황은 관리자만 등록·수정·삭제할 수 있습니다.");
    }
  }

  // 등록 대상 팀원이 없거나 비활성이면 입력 오류
  private Member getActiveTarget(Long memberId) {
    return memberRepository.findById(memberId)
      .filter(Member::isActive)
      .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT,
        "비활성 팀원에게는 등록할 수 없습니다"));
  }
}
