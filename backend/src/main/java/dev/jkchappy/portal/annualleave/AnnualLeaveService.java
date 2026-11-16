package dev.jkchappy.portal.annualleave;

import dev.jkchappy.portal.annualleave.dto.AnnualLeaveBalanceRequest;
import dev.jkchappy.portal.annualleave.dto.AnnualLeaveSummaryResponse;
import dev.jkchappy.portal.annualleave.dto.LeaveUsageDay;
import dev.jkchappy.portal.annualleave.dto.WeeklyLeaveUsage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.member.MemberOrder;
import dev.jkchappy.portal.workstatus.WorkStatus;
import dev.jkchappy.portal.workstatus.WorkStatusRepository;
import dev.jkchappy.portal.workstatus.WorkStatusType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import dev.jkchappy.portal.live.LiveUpdateEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AnnualLeaveService {

  private static final BigDecimal HALF_DAY = new BigDecimal("0.5");
  private static final BigDecimal QUARTER_DAY = new BigDecimal("0.25");

  private final AnnualLeaveBalanceRepository balanceRepository;
  private final WorkStatusRepository workStatusRepository;
  private final MemberRepository memberRepository;
  private final MemberService memberService;
  private final ApplicationEventPublisher events;

  @Transactional(readOnly = true)
  public List<AnnualLeaveSummaryResponse> findByYear(int year) {
    validateYear(year);
    Map<Long, AnnualLeaveBalance> balances = balanceRepository.findByYear(year).stream()
      .collect(Collectors.toMap(AnnualLeaveBalance::getMemberId, Function.identity()));
    Map<Long, TreeMap<Integer, WeekUsage>> usage = calculateUsage(year);

    // 가입된 팀원은 모두, 삭제한 팀원은 삭제한 해까지만 표시
    return MemberOrder.sorted(memberRepository.findVisibleInYear(LocalDate.of(year, 1, 1))).stream()
      .map(member -> toResponse(member, balances.get(member.getId()),
        usage.getOrDefault(member.getId(), new TreeMap<>())))
      .toList();
  }

  @Transactional
  public AnnualLeaveSummaryResponse update(Long memberId, int year,
    AnnualLeaveBalanceRequest request, Long currentUserId) {
    validateYear(year);
    memberService.getActiveMember(currentUserId);
    Member member = memberRepository.findById(memberId)
      .filter(Member::isActive)
      .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT,
        "활성 팀원의 연차만 설정할 수 있습니다."));
    AnnualLeaveBalance balance = balanceRepository.findByMemberIdAndYear(memberId, year)
      .orElseGet(() -> AnnualLeaveBalance.create(memberId, year, request.confirmedDays(),
        request.carriedDays()));
    balance.change(request.confirmedDays(), request.carriedDays());
    AnnualLeaveBalance saved = balanceRepository.save(balance);
    // 연차 표는 근무 상황표 화면에 함께 있어 같은 알림 사용
    events.publishEvent(new LiveUpdateEvent(LiveUpdateEvent.WORK_STATUS));
    return toResponse(member, saved, calculateUsage(year).getOrDefault(memberId, new TreeMap<>()));
  }

  // 한 주의 사용 일수와 연차를 쓴 날짜 목록
  // 공가·기타는 날짜 목록(메모)에는 넣되 사용 일수에 더하지 않음 (그 주만 공가·기타면 0일로 보임)
  private static final class WeekUsage {
    private BigDecimal days = BigDecimal.ZERO;
    private final List<LeaveUsageDay> dates = new ArrayList<>();

    private void add(LocalDate date, BigDecimal amount, String label, boolean notCounted) {
      if (!notCounted) {
        days = days.add(amount);
      }
      dates.add(new LeaveUsageDay(date, label));
    }
  }

  // 팀원별 (월*10+주) → 사용 일수와 날짜. 연도 밖 날짜와 기간 연차의 주말은 제외
  private Map<Long, TreeMap<Integer, WeekUsage>> calculateUsage(int year) {
    LocalDate from = LocalDate.of(year, 1, 1);
    LocalDate to = LocalDate.of(year, 12, 31);
    Map<Long, TreeMap<Integer, WeekUsage>> result = new HashMap<>();
    for (WorkStatus status : workStatusRepository.findLeaveOverlapping(from, to)) {
      TreeMap<Integer, WeekUsage> usage = result.computeIfAbsent(status.getMemberId(),
        id -> new TreeMap<>());
      boolean official = status.getType() == WorkStatusType.OFFICIAL_LEAVE;
      String typeName = status.getHalfDayPeriod() == null
        ? status.getType().getDisplayName()
        : status.getHalfDayPeriod().getDisplayName() + " " + status.getType().getDisplayName();
      // 공가 사유가 있으면 메모에 함께 표시 (예: 공가(예비군))
      // 기타(예: 생일반차)도 공가처럼 메모에만 내용을 표시하고 연차에서 빼지 않음 (0일)
      boolean other = status.getType() == WorkStatusType.OTHER;
      boolean notCounted = official || other;
      String label = other && status.getContent() != null ? status.getContent()
        : official && status.getContent() != null ? typeName + "(" + status.getContent() + ")" : typeName;
      // 반차·반반차와 오전/오후 공가는 하루짜리
      boolean partDay = status.getType() == WorkStatusType.HALF_DAY || status.getType() == WorkStatusType.QUARTER_DAY
        || (official && status.getHalfDayPeriod() != null);
      if (partDay) {
        BigDecimal days = status.getType() == WorkStatusType.QUARTER_DAY ? QUARTER_DAY : HALF_DAY;
        LocalDate date = status.getStartDate();
        if (date.getYear() == year) {
          usage.computeIfAbsent(weekKey(date), key -> new WeekUsage()).add(date, days, label, notCounted);
        }
        continue;
      }
      LocalDate start = status.getStartDate().isBefore(from) ? from : status.getStartDate();
      LocalDate end = status.getEndDate().isAfter(to) ? to : status.getEndDate();
      start.datesUntil(end.plusDays(1))
        .filter(date -> !LeaveWeek.isWeekend(date))
        .forEach(date -> usage.computeIfAbsent(weekKey(date), key -> new WeekUsage())
          .add(date, BigDecimal.ONE, label, notCounted));
    }
    return result;
  }

  private int weekKey(LocalDate date) {
    return date.getMonthValue() * 10 + LeaveWeek.weekOfMonth(date);
  }

  private AnnualLeaveSummaryResponse toResponse(Member member, AnnualLeaveBalance balance,
    TreeMap<Integer, WeekUsage> usage) {
    List<WeeklyLeaveUsage> weeklyUsages = usage.entrySet().stream()
      .map(e -> new WeeklyLeaveUsage(e.getKey() / 10, e.getKey() % 10, e.getValue().days,
        e.getValue().dates.stream().sorted(Comparator.comparing(LeaveUsageDay::date)).toList()))
      .toList();
    BigDecimal usedDays = usage.values().stream().map(week -> week.days)
      .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal confirmedDays = balance == null ? BigDecimal.ZERO : balance.getConfirmedDays();
    BigDecimal carriedDays = balance == null ? BigDecimal.ZERO : balance.getCarriedDays();
    BigDecimal totalDays = confirmedDays.add(carriedDays);
    return new AnnualLeaveSummaryResponse(member.getId(), member.getName(), confirmedDays,
      carriedDays, totalDays, usedDays, totalDays.subtract(usedDays), weeklyUsages, member.isActive());
  }

  private void validateYear(int year) {
    if (year < 1 || year > 9999) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "연도가 올바르지 않습니다.");
    }
  }
}
