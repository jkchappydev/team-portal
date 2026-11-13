package dev.jkchappy.portal.workstatus;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeList;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications/work-status")
@RequiredArgsConstructor
public class WorkStatusNoticeController {

  private final WorkStatusNoticeService noticeService;

  @GetMapping
  public ApiResponse<WorkStatusNoticeList> unread(@CurrentUser Long userId) {
    return ApiResponse.ok(noticeService.findUnread(userId));
  }

  @PostMapping("/{id}/read")
  public ApiResponse<Void> read(@PathVariable Long id, @CurrentUser Long userId) {
    noticeService.markRead(userId, id);
    return ApiResponse.ok(null);
  }

  @PostMapping("/read-all")
  public ApiResponse<Void> readAll(@CurrentUser Long userId) {
    noticeService.markAllRead(userId);
    return ApiResponse.ok(null);
  }
}
