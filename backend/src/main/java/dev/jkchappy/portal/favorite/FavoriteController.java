package dev.jkchappy.portal.favorite;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.favorite.dto.FavoriteOrderRequest;
import dev.jkchappy.portal.favorite.dto.FavoriteResponse;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// 내 즐겨찾기 API, 바꾼 뒤에는 바뀐 전체 목록을 돌려줌
@RestController
@RequiredArgsConstructor
public class FavoriteController {

  private final FavoriteService favoriteService;

  @GetMapping("/api/me/favorites")
  public ApiResponse<List<FavoriteResponse>> list(@CurrentUser Long userId) {
    return ApiResponse.ok(favoriteService.list(userId));
  }

  @PutMapping("/api/me/favorites/{documentId}")
  public ApiResponse<List<FavoriteResponse>> add(@PathVariable Long documentId, @CurrentUser Long userId) {
    return ApiResponse.ok(favoriteService.add(userId, documentId));
  }

  @DeleteMapping("/api/me/favorites/{documentId}")
  public ApiResponse<List<FavoriteResponse>> remove(@PathVariable Long documentId, @CurrentUser Long userId) {
    return ApiResponse.ok(favoriteService.remove(userId, documentId));
  }

  @PatchMapping("/api/me/favorites/{documentId}/order")
  public ApiResponse<List<FavoriteResponse>> move(@PathVariable Long documentId,
    @Valid @RequestBody FavoriteOrderRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(favoriteService.move(userId, documentId, request.index()));
  }
}
