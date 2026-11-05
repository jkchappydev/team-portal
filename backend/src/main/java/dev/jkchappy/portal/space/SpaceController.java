package dev.jkchappy.portal.space;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.space.dto.SpacePositionRequest;
import dev.jkchappy.portal.space.dto.SpaceRequest;
import dev.jkchappy.portal.space.dto.SpaceResponse;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/spaces")
@RequiredArgsConstructor
public class SpaceController {

  private final SpaceService spaceService;

  @GetMapping
  public ApiResponse<List<SpaceResponse>> list() {
    return ApiResponse.ok(spaceService.findAll());
  }

  @PostMapping
  public ApiResponse<SpaceResponse> create(
    @Valid @RequestBody SpaceRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(spaceService.create(request, userId));
  }

  @PatchMapping("/{id}")
  public ApiResponse<SpaceResponse> update(
    @PathVariable Long id, @Valid @RequestBody SpaceRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(spaceService.update(id, request));
  }

  // 사이드바에서 끌어 옮긴 최상위 페이지 순서 변경
  @PatchMapping("/{id}/position")
  public ApiResponse<Void> move(@PathVariable Long id, @Valid @RequestBody SpacePositionRequest request,
    @CurrentUser Long userId) {
    spaceService.move(id, request.index());
    return ApiResponse.ok(null);
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    spaceService.delete(id);
    return ApiResponse.ok(null);
  }

  @PostMapping("/{id}/restore")
  public ApiResponse<Void> restore(@PathVariable Long id, @CurrentUser Long userId) {
    spaceService.restore(id);
    return ApiResponse.ok(null);
  }
}
