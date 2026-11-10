package dev.jkchappy.portal.profile;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.profile.dto.ProfileColorRequest;
import dev.jkchappy.portal.profile.dto.ProfileResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// 내 프로필(색·이미지) API, 바꾸기는 본인만
@RestController
@RequiredArgsConstructor
public class ProfileController {

  private final ProfileService profileService;

  @GetMapping("/api/me/profile")
  public ApiResponse<ProfileResponse> get(@CurrentUser Long userId) {
    return ApiResponse.ok(profileService.get(userId));
  }

  @PutMapping("/api/me/profile/color")
  public ApiResponse<ProfileResponse> changeColor(@RequestBody ProfileColorRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(profileService.changeColor(userId, request.color()));
  }

  @PostMapping("/api/me/profile/image")
  public ApiResponse<ProfileResponse> changeImage(@RequestParam("file") MultipartFile file, @CurrentUser Long userId) {
    return ApiResponse.ok(profileService.changeImage(userId, file));
  }

  @DeleteMapping("/api/me/profile/image")
  public ApiResponse<ProfileResponse> removeImage(@CurrentUser Long userId) {
    return ApiResponse.ok(profileService.removeImage(userId));
  }

  // 주소에 이미지 버전이 들어 있어 하루 동안 브라우저 캐시 사용
  @GetMapping("/api/members/{id}/profile-image")
  public ResponseEntity<Resource> image(@PathVariable Long id, @CurrentUser Long userId) {
    ProfileService.Image image = profileService.loadImage(id);
    return ResponseEntity.ok()
      .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
      .header("X-Content-Type-Options", "nosniff")
      .contentType(MediaType.parseMediaType(image.contentType()))
      .body(image.resource());
  }
}
