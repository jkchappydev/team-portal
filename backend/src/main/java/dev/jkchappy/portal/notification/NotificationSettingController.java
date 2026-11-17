package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.notification.dto.NotificationSettingRequest;
import dev.jkchappy.portal.notification.dto.NotificationSettingResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// 내 알림 설정 API (본인 설정만 조회·변경)
@RestController
@RequiredArgsConstructor
public class NotificationSettingController {

  private final NotificationSettingService notificationSettingService;

  @GetMapping("/api/me/notification-settings")
  public ApiResponse<List<NotificationSettingResponse>> list(@CurrentUser Long userId) {
    return ApiResponse.ok(notificationSettingService.findMine(userId));
  }

  @PutMapping("/api/me/notification-settings/{spaceId}")
  public ApiResponse<NotificationSettingResponse> change(@PathVariable Long spaceId,
    @Valid @RequestBody NotificationSettingRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(notificationSettingService.change(userId, spaceId, request.level()));
  }
}
