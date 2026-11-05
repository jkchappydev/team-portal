package dev.jkchappy.portal.annualleave;

import dev.jkchappy.portal.annualleave.dto.AnnualLeaveBalanceRequest;
import dev.jkchappy.portal.annualleave.dto.AnnualLeaveSummaryResponse;
import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/annual-leaves")
@RequiredArgsConstructor
public class AnnualLeaveController {

  private final AnnualLeaveService annualLeaveService;

  @GetMapping
  public ApiResponse<List<AnnualLeaveSummaryResponse>> list(@RequestParam int year) {
    return ApiResponse.ok(annualLeaveService.findByYear(year));
  }

  @PutMapping("/{memberId}")
  public ApiResponse<AnnualLeaveSummaryResponse> update(@PathVariable Long memberId,
    @RequestParam int year, @Valid @RequestBody AnnualLeaveBalanceRequest request,
    @CurrentUser Long userId) {
    return ApiResponse.ok(annualLeaveService.update(memberId, year, request, userId));
  }
}
