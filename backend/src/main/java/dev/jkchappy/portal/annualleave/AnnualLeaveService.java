package dev.jkchappy.portal.annualleave;

import dev.jkchappy.portal.annualleave.dto.AnnualLeaveBalanceRequest;
import dev.jkchappy.portal.annualleave.dto.AnnualLeaveSummaryResponse;
import dev.jkchappy.portal.annualleave.dto.WeeklyLeaveUsage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.workstatus.WorkStatus;
import dev.jkchappy.portal.workstatus.WorkStatusRepository;
import dev.jkchappy.portal.workstatus.WorkStatusType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
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

  @Transactional(readOnly = true)
  public List<AnnualLeaveSummaryResponse> findByYear(int year) {
    validateYear(year);
    Map<Long, AnnualLeaveBalance> balances = balanceRepository.findByYear(year).stream()
      .collect(Collectors.toMap(AnnualLeaveBalance::getMemberId, Function.identity()));
    Map<Long, TreeMap<Integer, BigDecimal>> usage = calculateUsage(year);

    return memberRepository.findByActiveTrueOrderByNameAsc().stream()
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
    return toResponse(member, saved, calculateUsage(year).getOrDefault(memberId, new TreeMap<>()));
  }

  // 팀원별 (월*10+주) → 사용 일수. 연도 밖 날짜와 기간 연차의 주말은 제외
  private Map<Long, TreeMap<Integer, BigDecimal>> calculateUsage(int year) {
    LocalDate from = LocalDate.of(year, 1, 1);
    LocalDate to = LocalDate.of(year, 12, 31);
    Map<Long, TreeMap<Integer, BigDecimal>> result = new HashMap<>();
    for (WorkStatus status : workStatusRepository.findLeaveOverlapping(from, to)) {
      TreeMap<Integer, BigDecimal> usage = result.computeIfAbsent(status.getMemberId(),
        id -> new TreeMap<>());
      if (status.getType() == WorkStatusType.HALF_DAY || status.getType() == WorkStatusType.QUARTER_DAY) {
        BigDecimal days = status.getType() == WorkStatusType.HALF_DAY ? HALF_DAY : QUARTER_DAY;
        usage.merge(weekKey(status.getStartDate()), days, BigDecimal::add);
        continue;
      }
      LocalDate start = status.getStartDate().isBefore(from) ? from : status.getStartDate();
      LocalDate end = status.getEndDate().isAfter(to) ? to : status.getEndDate();
      start.datesUntil(end.plusDays(1))
        .filter(date -> !LeaveWeek.isWeekend(date))
        .forEach(date -> usage.merge(weekKey(date), BigDecimal.ONE, BigDecimal::add));
    }
    return result;
  }

  private int weekKey(LocalDate date) {
    return date.getMonthValue() * 10 + LeaveWeek.weekOfMonth(date);
  }

  private AnnualLeaveSummaryResponse toResponse(Member member, AnnualLeaveBalance balance,
    TreeMap<Integer, BigDecimal> usage) {
    List<WeeklyLeaveUsage> weeklyUsages = usage.entrySet().stream()
      .map(e -> new WeeklyLeaveUsage(e.getKey() / 10, e.getKey() % 10, e.getValue()))
      .toList();
    BigDecimal usedDays = usage.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal confirmedDays = balance == null ? BigDecimal.ZERO : balance.getConfirmedDays();
    BigDecimal carriedDays = balance == null ? BigDecimal.ZERO : balance.getCarriedDays();
    BigDecimal totalDays = confirmedDays.add(carriedDays);
    return new AnnualLeaveSummaryResponse(member.getId(), member.getName(), confirmedDays,
      carriedDays, totalDays, usedDays, totalDays.subtract(usedDays), weeklyUsages);
  }

  private void validateYear(int year) {
    if (year < 1 || year > 9999) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "연도가 올바르지 않습니다.");
    }
  }
}
