package dev.jkchappy.portal.member;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.dto.MemberCreateRequest;
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// 팀원 API (처음 이름 선택 전에도 써야 하므로 X-User-Id 불필요)
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

  private final MemberService memberService;

  @GetMapping
  public ApiResponse<List<MemberResponse>> list(
    @RequestParam(defaultValue = "false") boolean includeInactive) {
    return ApiResponse.ok(memberService.findAll(includeInactive));
  }

  @PostMapping
  public ApiResponse<MemberResponse> create(@Valid @RequestBody MemberCreateRequest request) {
    return ApiResponse.ok(memberService.create(request));
  }

  @PatchMapping("/{id}")
  public ApiResponse<MemberResponse> update(
    @PathVariable Long id, @Valid @RequestBody MemberUpdateRequest request) {
    return ApiResponse.ok(memberService.update(id, request));
  }
}
