package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.DocumentCreateRequest;
import dev.jkchappy.portal.document.dto.DocumentDetail;
import dev.jkchappy.portal.document.dto.DocumentIconRequest;
import dev.jkchappy.portal.document.dto.DocumentMoveRequest;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.document.dto.DocumentTitleRequest;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DocumentController {

  private final DocumentService documentService;

  @GetMapping("/api/spaces/{spaceId}/documents")
  public ApiResponse<List<DocumentSummary>> listBySpace(@PathVariable Long spaceId) {
    return ApiResponse.ok(documentService.findBySpace(spaceId));
  }

  @PostMapping("/api/spaces/{spaceId}/documents")
  public ApiResponse<DocumentSummary> create(@PathVariable Long spaceId,
    @Valid @RequestBody(required = false) DocumentCreateRequest request, @CurrentUser Long userId) {
    String title = request == null ? null : request.title();
    Long parentId = request == null ? null : request.parentId();
    return ApiResponse.ok(documentService.create(spaceId, title, parentId, userId));
  }

  @GetMapping("/api/documents/search")
  public ApiResponse<List<DocumentSummary>> search(@RequestParam(defaultValue = "") String q) {
    return ApiResponse.ok(documentService.search(q));
  }

  @GetMapping("/api/documents/{id}")
  public ApiResponse<DocumentDetail> get(@PathVariable Long id) {
    return ApiResponse.ok(documentService.getDetail(id));
  }

  @PatchMapping("/api/documents/{id}/title")
  public ApiResponse<DocumentDetail> rename(@PathVariable Long id,
    @Valid @RequestBody DocumentTitleRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(documentService.rename(id, request.title(), userId));
  }

  @PatchMapping("/api/documents/{id}/parent")
  public ApiResponse<DocumentDetail> move(@PathVariable Long id,
    @Valid @RequestBody DocumentMoveRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(documentService.move(id, request.parentId(), request.index()));
  }

  @PatchMapping("/api/documents/{id}/icon")
  public ApiResponse<DocumentDetail> changeIcon(@PathVariable Long id,
    @Valid @RequestBody DocumentIconRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(documentService.changeIcon(id, request.icon(), userId));
  }

  @DeleteMapping("/api/documents/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    documentService.delete(id);
    return ApiResponse.ok(null);
  }

  @PostMapping("/api/documents/{id}/restore")
  public ApiResponse<Void> restore(@PathVariable Long id, @CurrentUser Long userId) {
    documentService.restore(id);
    return ApiResponse.ok(null);
  }
}
