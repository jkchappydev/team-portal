package dev.jkchappy.portal.account;

import dev.jkchappy.portal.account.dto.SignupRequestResponse;
import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.dto.MemberResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
  private final AccountService accounts;
  public record ApproveRequest(Long memberId, String newMemberName, String department, JobRank jobRank) {}
  public record AdminFlagRequest(@NotNull Boolean admin) {}

  @GetMapping("/signup-requests")
  public ApiResponse<List<SignupRequestResponse>> list(@CurrentUser Long userId) {
    accounts.requireAdmin(userId);
    return ApiResponse.ok(accounts.listRequests());
  }

  @GetMapping("/signup-requests/count")
  public ApiResponse<Map<String, Long>> count(@CurrentUser Long userId) {
    accounts.requireAdmin(userId);
    return ApiResponse.ok(Map.of("pending", accounts.countPending()));
  }

  @PostMapping("/signup-requests/{id}/approve")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void approve(@CurrentUser Long userId, @PathVariable Long id, @RequestBody ApproveRequest request) {
    accounts.requireAdmin(userId);
    if ((request.memberId() == null) == (request.newMemberName() == null)) throw new BusinessException(ErrorCode.INVALID_INPUT);
    if (request.department() == null || request.department().isBlank() || request.jobRank() == null) throw new BusinessException(ErrorCode.INVALID_INPUT);
    if (request.memberId() != null) accounts.approveWithMember(id, request.memberId(), userId, request.department(), request.jobRank());
    else accounts.approveAsNewMember(id, request.newMemberName(), userId, request.department(), request.jobRank());
  }

  @PostMapping("/signup-requests/{id}/reject")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void reject(@CurrentUser Long userId, @PathVariable Long id) {
    accounts.requireAdmin(userId);
    accounts.reject(id, userId);
  }

  @PostMapping("/signup-requests/{id}/reopen")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void reopen(@CurrentUser Long userId, @PathVariable Long id) {
    accounts.requireAdmin(userId);
    accounts.reopen(id);
  }

  @PatchMapping("/members/{id}/admin")
  public ApiResponse<MemberResponse> setAdmin(@CurrentUser Long userId, @PathVariable Long id,
    @Valid @RequestBody AdminFlagRequest request) {
    accounts.requireAdmin(userId);
    return ApiResponse.ok(accounts.setAdmin(id, request.admin()));
  }
}
