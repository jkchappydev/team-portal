package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.TrashResponse;
import dev.jkchappy.portal.member.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trash")
@RequiredArgsConstructor
public class TrashController {

  private final DocumentService documentService;
  private final TrashService trashService;

  @GetMapping
  public ApiResponse<TrashResponse> trash() {
    return ApiResponse.ok(documentService.findTrash());
  }

  @DeleteMapping("/documents/{id}")
  public ApiResponse<Void> purgeDocument(@PathVariable Long id, @CurrentUser Long userId) {
    trashService.purgeDocument(id);
    return ApiResponse.ok(null);
  }

  @DeleteMapping("/spaces/{id}")
  public ApiResponse<Void> purgeSpace(@PathVariable Long id, @CurrentUser Long userId) {
    trashService.purgeSpace(id);
    return ApiResponse.ok(null);
  }
}
