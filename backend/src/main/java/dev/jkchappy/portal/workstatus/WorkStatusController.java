package dev.jkchappy.portal.workstatus;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.workstatus.dto.WorkStatusRequest;
import dev.jkchappy.portal.workstatus.dto.WorkStatusResponse;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/work-statuses")
@RequiredArgsConstructor
public class WorkStatusController {

  private final WorkStatusService workStatusService;

  @GetMapping
  public ApiResponse<List<WorkStatusResponse>> list(@RequestParam int year, @RequestParam int month) {
    // 월 범위(1~12) 검증
    if (month < 1 || month > 12 || year < 1 || year > 9999) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "연도 또는 월이 올바르지 않습니다.");
    }
    return ApiResponse.ok(workStatusService.findByMonth(YearMonth.of(year, month)));
  }

  @PostMapping
  public ApiResponse<WorkStatusResponse> create(
    @Valid @RequestBody WorkStatusRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(workStatusService.create(request, userId));
  }

  @PutMapping("/{id}")
  public ApiResponse<WorkStatusResponse> update(
    @PathVariable Long id, @Valid @RequestBody WorkStatusRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(workStatusService.update(id, request, userId));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    workStatusService.delete(id, userId);
    return ApiResponse.ok(null);
  }
}
