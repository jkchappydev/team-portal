package dev.jkchappy.portal.annualleave;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.annualleave.dto.AnnualLeaveBalanceRequest;
import dev.jkchappy.portal.annualleave.dto.AnnualLeaveSummaryResponse;
import dev.jkchappy.portal.annualleave.dto.WeeklyLeaveUsage;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.workstatus.HalfDayPeriod;
import dev.jkchappy.portal.workstatus.WorkStatus;
import dev.jkchappy.portal.workstatus.WorkStatusRepository;
import dev.jkchappy.portal.workstatus.WorkStatusType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AnnualLeaveServiceTest {

  @Mock
  private AnnualLeaveBalanceRepository balanceRepository;

  @Mock
  private WorkStatusRepository workStatusRepository;

  @Mock
  private MemberRepository memberRepository;

  @Mock
  private MemberService memberService;

  @Mock
  private ApplicationEventPublisher events;

  private AnnualLeaveService service() {
    return new AnnualLeaveService(balanceRepository, workStatusRepository, memberRepository,
      memberService, events);
  }

  private Member member(long id, String name) {
    Member member = Member.create(name);
    ReflectionTestUtils.setField(member, "id", id);
    return member;
  }

  private WorkStatus status(long memberId, WorkStatusType type, LocalDate start, LocalDate end) {
    HalfDayPeriod period = type == WorkStatusType.HALF_DAY || type == WorkStatusType.QUARTER_DAY
      ? HalfDayPeriod.AM : null;
    return WorkStatus.create(memberId, type, start, end, period, null, null, null, null, memberId);
  }

  @Test
  void findByYear_calculatesLeaveHalfDayAndQuarterDay() {
    Member member = member(1L, "홍길동");
    AnnualLeaveBalance balance = AnnualLeaveBalance.create(1L, 2026,
      new BigDecimal("15"), new BigDecimal("1"));
    when(memberRepository.findVisibleInYear(LocalDate.of(2026, 1, 1))).thenReturn(List.of(member));
    when(balanceRepository.findByYear(2026)).thenReturn(List.of(balance));
    when(workStatusRepository.findLeaveOverlapping(LocalDate.of(2026, 1, 1),
      LocalDate.of(2026, 12, 31))).thenReturn(List.of(
      status(1L, WorkStatusType.LEAVE, LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 9)),
      status(1L, WorkStatusType.HALF_DAY, LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 10)),
      status(1L, WorkStatusType.QUARTER_DAY, LocalDate.of(2026, 11, 11), LocalDate.of(2026, 11, 11))));

    AnnualLeaveSummaryResponse result = service().findByYear(2026).getFirst();

    assertThat(result.totalDays()).isEqualByComparingTo("16");
    assertThat(result.usedDays()).isEqualByComparingTo("2.75");
    assertThat(result.remainingDays()).isEqualByComparingTo("13.25");
  }

  // 11/6(금)~11/9(월) 연차는 주가 갈려 1주 1일, 2주 1일로 나뉨 (주말 제외)
  @Test
  void findByYear_splitsUsageByCalendarWeek() {
    Member member = member(1L, "홍길동");
    when(memberRepository.findVisibleInYear(LocalDate.of(2026, 1, 1))).thenReturn(List.of(member));
    when(balanceRepository.findByYear(2026)).thenReturn(List.of());
    when(workStatusRepository.findLeaveOverlapping(LocalDate.of(2026, 1, 1),
      LocalDate.of(2026, 12, 31))).thenReturn(List.of(
      status(1L, WorkStatusType.LEAVE, LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 9)),
      status(1L, WorkStatusType.HALF_DAY, LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 10)),
      status(1L, WorkStatusType.QUARTER_DAY, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 1))));

    AnnualLeaveSummaryResponse result = service().findByYear(2026).getFirst();

    assertThat(result.weeklyUsages()).extracting(WeeklyLeaveUsage::month, WeeklyLeaveUsage::week)
      .containsExactly(
        org.assertj.core.groups.Tuple.tuple(10, 1),
        org.assertj.core.groups.Tuple.tuple(11, 1),
        org.assertj.core.groups.Tuple.tuple(11, 2));
    assertThat(result.weeklyUsages()).extracting(WeeklyLeaveUsage::days)
      .usingElementComparator(BigDecimal::compareTo)
      .containsExactly(new BigDecimal("0.25"), BigDecimal.ONE, new BigDecimal("1.5"));
    assertThat(result.usedDays()).isEqualByComparingTo("2.75");
  }

  // 연도를 걸친 연차는 해당 연도 날짜만 집계
  @Test
  void findByYear_leaveAcrossYearBoundary_countsOnlyThisYear() {
    Member member = member(1L, "홍길동");
    when(memberRepository.findVisibleInYear(LocalDate.of(2026, 1, 1))).thenReturn(List.of(member));
    when(balanceRepository.findByYear(2026)).thenReturn(List.of());
    when(workStatusRepository.findLeaveOverlapping(LocalDate.of(2026, 1, 1),
      LocalDate.of(2026, 12, 31))).thenReturn(List.of(
      status(1L, WorkStatusType.LEAVE, LocalDate.of(2025, 12, 30), LocalDate.of(2026, 1, 2))));

    AnnualLeaveSummaryResponse result = service().findByYear(2026).getFirst();

    assertThat(result.usedDays()).isEqualByComparingTo("2");
    assertThat(result.weeklyUsages()).hasSize(1);
    assertThat(result.weeklyUsages().getFirst().month()).isEqualTo(1);
    assertThat(result.weeklyUsages().getFirst().week()).isEqualTo(1);
  }

  @Test
  void update_createsBalanceAndReturnsCurrentUsage() {
    Member member = member(1L, "홍길동");
    when(memberService.getActiveMember(9L)).thenReturn(member(9L, "관리자"));
    when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
    when(balanceRepository.findByMemberIdAndYear(1L, 2026)).thenReturn(Optional.empty());
    when(balanceRepository.save(any(AnnualLeaveBalance.class)))
      .thenAnswer(invocation -> invocation.getArgument(0));
    when(workStatusRepository.findLeaveOverlapping(any(), any())).thenReturn(List.of(
      status(1L, WorkStatusType.HALF_DAY, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 1))));

    AnnualLeaveSummaryResponse result = service().update(1L, 2026,
      new AnnualLeaveBalanceRequest(new BigDecimal("15"), new BigDecimal("2")), 9L);

    assertThat(result.confirmedDays()).isEqualByComparingTo("15");
    assertThat(result.carriedDays()).isEqualByComparingTo("2");
    assertThat(result.usedDays()).isEqualByComparingTo("0.5");
    assertThat(result.remainingDays()).isEqualByComparingTo("16.5");
  }

  @Test
  void findByYear_inactiveOrDeletedMember_isReadOnly() {
    Member active = member(1L, "재직자");
    Member left = member(2L, "퇴사자");
    left.markDeleted(LocalDate.of(2026, 6, 30));
    when(memberRepository.findVisibleInYear(LocalDate.of(2026, 1, 1))).thenReturn(List.of(active, left));
    when(balanceRepository.findByYear(2026)).thenReturn(List.of());

    List<AnnualLeaveSummaryResponse> result = service().findByYear(2026);

    assertThat(result).extracting(AnnualLeaveSummaryResponse::memberName).containsExactly("재직자", "퇴사자");
    assertThat(result).extracting(AnnualLeaveSummaryResponse::editable).containsExactly(true, false);
  }
}
