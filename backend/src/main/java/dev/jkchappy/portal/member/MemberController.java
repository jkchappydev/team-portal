package dev.jkchappy.portal.member;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.member.dto.MemberCreateRequest;
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;

// 팀원 API
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

  private final MemberService memberService;
  private final AccountService accountService;

  @GetMapping
  public ApiResponse<List<MemberResponse>> list(
    @RequestParam(defaultValue = "false") boolean includeInactive, @CurrentUser Long userId) {
    return ApiResponse.ok(memberService.findAll(includeInactive));
  }

  @PostMapping
  public ApiResponse<MemberResponse> create(@Valid @RequestBody MemberCreateRequest request, @CurrentUser Long userId) {
    accountService.requireAdmin(userId);
    return ApiResponse.ok(memberService.create(request));
  }

  @PatchMapping("/{id}")
  public ApiResponse<MemberResponse> update(
    @PathVariable Long id, @Valid @RequestBody MemberUpdateRequest request, @CurrentUser Long userId) {
    accountService.requireAdmin(userId);
    return ApiResponse.ok(memberService.update(id, request));
  }

  // 퇴사자 등 목록에서 삭제 (기록은 유지)
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, @CurrentUser Long userId) {
    accountService.requireAdmin(userId);
    memberService.delete(id, userId);
  }

  public record MoveRequest(Long beforeId) {}

  @PatchMapping("/{id}/position")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void move(@PathVariable Long id, @RequestBody MoveRequest request, @CurrentUser Long userId) {
    accountService.requireAdmin(userId);
    memberService.move(id, request.beforeId());
  }
}
