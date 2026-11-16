package dev.jkchappy.portal.workstatus;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.workstatus.dto.WorkStatusRequest;
import org.springframework.stereotype.Component;

// 근무 상황 종류별 입력 규칙 검증
@Component
public class WorkStatusValidator {

  public void validate(WorkStatusRequest r) {
    if (r.endDate().isBefore(r.startDate())) {
      throw invalid("종료일은 시작일보다 빠를 수 없습니다.");
    }
    WorkStatusType type = r.type();
    boolean singleDayOnly = type == WorkStatusType.HALF_DAY || type == WorkStatusType.QUARTER_DAY
      || type == WorkStatusType.OUTSIDE_WORK;
    if (singleDayOnly && !r.startDate().equals(r.endDate())) {
      throw invalid("반차, 반반차, 외근은 하루만 등록할 수 있습니다.");
    }
    // 공가는 오전/오후를 고르면 반나절이라 하루만
    if (type == WorkStatusType.OFFICIAL_LEAVE && r.halfDayPeriod() != null && !r.startDate().equals(r.endDate())) {
      throw invalid("오전/오후 공가는 하루만 등록할 수 있습니다.");
    }

    switch (type) {
      case HALF_DAY -> {
        if (r.halfDayPeriod() == null) {
          throw invalid("반차는 오전/오후를 선택해야 합니다.");
        }
      }
      case QUARTER_DAY -> {
        if (r.halfDayPeriod() == null) {
          throw invalid("반반차는 오전/오후를 선택해야 합니다.");
        }
      }
      case BUSINESS_TRIP -> requirePlace(r, "출장");
      case OUTSIDE_WORK -> {
        requirePlace(r, "외근");
        requireTimes(r, "외근");
      }
      case OTHER -> {
        if (isBlank(r.content())) {
          throw invalid("기타 근무는 내용을 입력해야 합니다.");
        }
        if ((r.startTime() == null) != (r.endTime() == null)) {
          throw invalid("시작 시간과 종료 시간은 함께 입력해야 합니다.");
        }
      }
      default -> {
      }
    }

    if (r.startTime() != null && r.endTime() != null && !r.startTime().isBefore(r.endTime())) {
      throw invalid("시작 시간은 종료 시간보다 빨라야 합니다.");
    }
  }

  private void requireTimes(WorkStatusRequest r, String name) {
    if (r.startTime() == null || r.endTime() == null) {
      throw invalid(name + "은(는) 시작 시간과 종료 시간이 필요합니다.");
    }
  }

  private void requirePlace(WorkStatusRequest r, String name) {
    if (isBlank(r.place())) {
      throw invalid(name + "은(는) 장소가 필요합니다.");
    }
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private BusinessException invalid(String message) {
    return new BusinessException(ErrorCode.INVALID_INPUT, message);
  }
}
