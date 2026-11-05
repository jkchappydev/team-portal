package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.member.CurrentUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DocumentUpdateController {

  private final DocumentUpdateService documentUpdateService;

  @GetMapping("/api/notifications/document-updates")
  public ApiResponse<List<DocumentSummary>> unread(@CurrentUser Long userId) {
    return ApiResponse.ok(documentUpdateService.findUnread(userId));
  }

  @PostMapping("/api/notifications/document-updates/read-all")
  public ApiResponse<Void> readAll(@CurrentUser Long userId) {
    documentUpdateService.markAllRead(userId);
    return ApiResponse.ok(null);
  }

  @PostMapping("/api/documents/{id}/read")
  public ApiResponse<Void> read(@PathVariable Long id, @CurrentUser Long userId) {
    documentUpdateService.markRead(userId, id);
    return ApiResponse.ok(null);
  }
}
