package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.workstatus.dto.WorkStatusRequest;
import dev.jkchappy.portal.workstatus.dto.WorkStatusResponse;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import dev.jkchappy.portal.live.LiveUpdateEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WorkStatusServiceTest {

  @Mock
  private WorkStatusRepository workStatusRepository;

  @Mock
  private MemberRepository memberRepository;

  @Mock
  private MemberService memberService;

  @Mock
  private ApplicationEventPublisher events;

  private WorkStatusService service() {
    return new WorkStatusService(workStatusRepository, memberRepository, memberService,
      new WorkStatusValidator(), events);
  }

  private static WorkStatus entry(long id, long memberId, WorkStatusType type) {
    boolean outside = type == WorkStatusType.OUTSIDE_WORK;
    WorkStatus w = WorkStatus.create(memberId, type, LocalDate.of(2026, 11, 2),
      LocalDate.of(2026, 11, 2), null, outside ? LocalTime.of(9, 0) : null,
      outside ? LocalTime.of(10, 0) : null, outside ? "장소" : null, null, 1L);
    ReflectionTestUtils.setField(w, "id", id);
    return w;
  }

  @Test
  void findByMonth_sortsByTypeThenName() {
    when(workStatusRepository.findOverlapping(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)))
      .thenReturn(List.of(entry(1, 1, WorkStatusType.OUTSIDE_WORK), entry(2, 2, WorkStatusType.LEAVE),
        entry(3, 3, WorkStatusType.LEAVE)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "김", 2L, "이", 3L, "김"));

    List<WorkStatusResponse> result = service().findByMonth(YearMonth.of(2026, 11));

    assertThat(result).extracting(WorkStatusResponse::id).containsExactly(3L, 2L, 1L);
    assertThat(result.get(2).type()).isEqualTo(WorkStatusType.OUTSIDE_WORK);
  }

  @Test
  void findByMonth_showsInactiveMemberName() {
    when(workStatusRepository.findOverlapping(any(), any()))
      .thenReturn(List.of(entry(1, 9, WorkStatusType.LEAVE)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(9L, "퇴사자"));

    List<WorkStatusResponse> result = service().findByMonth(YearMonth.of(2026, 11));

    assertThat(result.get(0).memberName()).isEqualTo("퇴사자");
    assertThat(result.get(0).label()).isEqualTo("퇴사자 연차");
  }

  @Test
  void create_clearsUnusedFields() {
    Member member = Member.create("홍길동");
    when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
    when(workStatusRepository.save(any(WorkStatus.class))).thenAnswer(inv -> inv.getArgument(0));

    WorkStatusResponse response = service().create(new WorkStatusRequest(1L, WorkStatusType.LEAVE,
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), HalfDayPeriod.AM, LocalTime.of(9, 0),
      LocalTime.of(10, 0), "장소", "내용"), 1L);

    assertThat(response.place()).isNull();
    assertThat(response.content()).isNull();
    assertThat(response.halfDayPeriod()).isNull();
    assertThat(response.startTime()).isNull();
    assertThat(response.endTime()).isNull();
  }

  @Test
  void create_quarterDay_keepsPeriodAndClearsTimes() {
    Member member = Member.create("홍길동");
    when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
    when(workStatusRepository.save(any(WorkStatus.class))).thenAnswer(inv -> inv.getArgument(0));

    WorkStatusResponse response = service().create(new WorkStatusRequest(1L,
      WorkStatusType.QUARTER_DAY, LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2),
      HalfDayPeriod.PM, LocalTime.of(16, 0), LocalTime.of(18, 0), null, null), 1L);

    assertThat(response.halfDayPeriod()).isEqualTo(HalfDayPeriod.PM);
    assertThat(response.startTime()).isNull();
    assertThat(response.endTime()).isNull();
  }

  @Test
  void create_inactiveTargetMember_throwsInvalidInput() {
    Member inactive = Member.create("비활성");
    inactive.deactivate();
    when(memberRepository.findById(1L)).thenReturn(Optional.of(inactive));

    assertThatThrownBy(() -> service().create(new WorkStatusRequest(1L, WorkStatusType.LEAVE,
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), null, null, null, null, null), 1L))
      .isInstanceOfSatisfying(BusinessException.class, e -> {
        assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
        assertThat(e.getMessage()).isEqualTo("비활성 팀원에게는 등록할 수 없습니다");
      });
  }

  @Test
  void update_unknownId_throwsNotFound() {
    when(workStatusRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().update(99L, new WorkStatusRequest(1L, WorkStatusType.LEAVE,
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), null, null, null, null, null), 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void create_publishesLiveUpdate() {
    when(memberRepository.findById(1L)).thenReturn(Optional.of(Member.create("홍길동")));
    when(workStatusRepository.save(any(WorkStatus.class))).thenAnswer(inv -> inv.getArgument(0));

    service().create(new WorkStatusRequest(1L, WorkStatusType.LEAVE,
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), null, null, null, null, null), 1L);

    verify(events).publishEvent(new LiveUpdateEvent(LiveUpdateEvent.WORK_STATUS));
    // 팀장 이상에게 남길 변경 알림 (바꾼 사람과 표기)
    verify(events).publishEvent(new WorkStatusChangedEvent(WorkStatusAction.CREATED, 1L, "홍길동 연차",
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2)));
  }

  @Test
  void delete_publishesLiveUpdate() {
    when(workStatusRepository.findById(5L)).thenReturn(Optional.of(entry(5, 2, WorkStatusType.LEAVE)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(2L, "이순신"));

    service().delete(5L, 7L);

    verify(workStatusRepository).delete(any(WorkStatus.class));
    verify(events).publishEvent(new LiveUpdateEvent(LiveUpdateEvent.WORK_STATUS));
    verify(events).publishEvent(new WorkStatusChangedEvent(WorkStatusAction.DELETED, 7L, "이순신 연차",
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2)));
  }

  @Test
  void delete_unknownId_throwsNotFound() {
    when(workStatusRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().delete(99L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    verify(events, never()).publishEvent(any(Object.class));
  }

  @Test
  void update_publishesNoticeWithNewLabel() {
    WorkStatus ws = entry(3, 1, WorkStatusType.LEAVE);
    when(workStatusRepository.findById(3L)).thenReturn(Optional.of(ws));
    when(memberRepository.findById(1L)).thenReturn(Optional.of(Member.create("홍길동")));

    service().update(3L, new WorkStatusRequest(1L, WorkStatusType.HALF_DAY, LocalDate.of(2026, 11, 3),
      LocalDate.of(2026, 11, 3), HalfDayPeriod.PM, null, null, null, null), 4L);

    verify(events).publishEvent(new WorkStatusChangedEvent(WorkStatusAction.UPDATED, 4L, "홍길동 반차(오후)",
      LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 3)));
  }
}
