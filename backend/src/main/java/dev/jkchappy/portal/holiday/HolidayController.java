package dev.jkchappy.portal.holiday;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.holiday.dto.HolidayResponse;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
public class HolidayController {

  private final HolidayService holidayService;

  @GetMapping
  public ApiResponse<List<HolidayResponse>> list(@RequestParam int year, @RequestParam int month) {
    if (month < 1 || month > 12 || year < 1 || year > 9999) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "연도 또는 월이 올바르지 않습니다.");
    }
    return ApiResponse.ok(holidayService.findByMonth(YearMonth.of(year, month)));
  }
}
