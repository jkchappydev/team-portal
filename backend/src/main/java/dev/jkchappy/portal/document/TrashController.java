package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.TrashResponse;
import dev.jkchappy.portal.form.FormTemplateService;
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
  private final FormTemplateService formService;

  // 삭제된 프로젝트·페이지와 공유 보관함 파일을 최근 삭제순으로 함께
  @GetMapping
  public ApiResponse<TrashResponse> trash() {
    return ApiResponse.ok(documentService.findTrash().with(formService.findTrash()));
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

  // 공유 보관함 파일 영구 삭제
  @DeleteMapping("/forms/{id}")
  public ApiResponse<Void> purgeForm(@PathVariable Long id, @CurrentUser Long userId) {
    formService.purge(id);
    return ApiResponse.ok(null);
  }
}
