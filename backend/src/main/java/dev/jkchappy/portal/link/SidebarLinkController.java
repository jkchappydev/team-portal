package dev.jkchappy.portal.link;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.link.dto.LinkPositionRequest;
import dev.jkchappy.portal.link.dto.LinkRequest;
import dev.jkchappy.portal.link.dto.LinkResponse;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 사이드바 링크 (팀원 모두가 같은 목록을 보고 추가·수정)
@RestController
@RequestMapping("/api/links")
@RequiredArgsConstructor
public class SidebarLinkController {

  private final SidebarLinkService linkService;

  @GetMapping
  public ApiResponse<List<LinkResponse>> list(@CurrentUser Long userId) {
    return ApiResponse.ok(linkService.findAll());
  }

  @PostMapping
  public ApiResponse<LinkResponse> create(@Valid @RequestBody LinkRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(linkService.create(request, userId));
  }

  // 링크 수정 (제목·주소·아이콘)
  @PutMapping("/{id}")
  public ApiResponse<LinkResponse> update(@PathVariable Long id, @Valid @RequestBody LinkRequest request,
    @CurrentUser Long userId) {
    return ApiResponse.ok(linkService.update(id, request));
  }

  // 사이드바에서 끌어 옮긴 링크 순서 변경
  @PatchMapping("/{id}/position")
  public ApiResponse<Void> move(@PathVariable Long id, @Valid @RequestBody LinkPositionRequest request,
    @CurrentUser Long userId) {
    linkService.move(id, request.index());
    return ApiResponse.ok(null);
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    linkService.delete(id);
    return ApiResponse.ok(null);
  }
}
