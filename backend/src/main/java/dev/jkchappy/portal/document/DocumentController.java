package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.DocumentCoverRequest;
import dev.jkchappy.portal.document.dto.DocumentCreateRequest;
import dev.jkchappy.portal.document.dto.DocumentDetail;
import dev.jkchappy.portal.document.dto.DocumentIconRequest;
import dev.jkchappy.portal.document.dto.DocumentMoveRequest;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.document.dto.DocumentTitleRequest;
import dev.jkchappy.portal.document.dto.RecentDocument;
import dev.jkchappy.portal.document.property.DocumentPropertyService;
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

  private static final int RECENT_LIMIT = 10;

  private final DocumentService documentService;
  private final DocumentPropertyService propertyService;

  @GetMapping("/api/spaces/{spaceId}/documents")
  public ApiResponse<List<DocumentSummary>> listBySpace(@PathVariable Long spaceId) {
    return ApiResponse.ok(documentService.findBySpace(spaceId));
  }

  @PostMapping("/api/spaces/{spaceId}/documents")
  public ApiResponse<DocumentSummary> create(@PathVariable Long spaceId,
    @Valid @RequestBody(required = false) DocumentCreateRequest request, @CurrentUser Long userId) {
    String title = request == null ? null : request.title();
    Long parentId = request == null ? null : request.parentId();
    DocumentKind kind = request == null || request.kind() == null ? DocumentKind.PAGE : request.kind();
    return ApiResponse.ok(documentService.create(spaceId, title, parentId, kind, userId));
  }

  // 메인 화면 최근 수정된 게시글 (최근 수정한 페이지·파일 10개)
  @GetMapping("/api/documents/recent")
  public ApiResponse<List<RecentDocument>> recent() {
    return ApiResponse.ok(documentService.findRecent(RECENT_LIMIT));
  }

  @GetMapping("/api/documents/search")
  public ApiResponse<List<DocumentSummary>> search(@RequestParam(defaultValue = "") String q) {
    return ApiResponse.ok(documentService.search(q));
  }

  @GetMapping("/api/documents/{id}")
  public ApiResponse<DocumentDetail> get(@PathVariable Long id) {
    return ApiResponse.ok(documentService.getDetail(id));
  }

  // 기존 하위 항목을 본문 맨 아래에 페이지 블록으로 붙일 목록 (문서마다 처음 한 번만, 이후 빈 목록)
  @PostMapping("/api/documents/{id}/page-block-backfill")
  public ApiResponse<List<Long>> claimPageBlockBackfill(@PathVariable Long id) {
    return ApiResponse.ok(documentService.claimPageBlockBackfill(id));
  }

  // 본문 페이지 블록 복제용 페이지 사본 생성
  // parentId: 사본을 둘 상위 페이지 (본문에 복사해 붙여넣은 페이지, 다른 프로젝트 본문도 가능), 없으면 원본과 같은 자리 (그때만 제목 뒤 "(사본)")
  @PostMapping("/api/documents/{id}/duplicate")
  public ApiResponse<DocumentSummary> duplicate(@PathVariable Long id,
    @RequestParam(required = false) Long parentId, @CurrentUser Long userId) {
    // 복제본에 속성(담당자 등)도 같은 값으로 복사
    DocumentSummary copied = documentService.duplicate(id, userId, parentId);
    propertyService.copyProperties(id, copied.id());
    return ApiResponse.ok(copied);
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

  // 프로젝트 본문 커버 변경 (비어 있으면 제거)
  @PatchMapping("/api/documents/{id}/cover")
  public ApiResponse<DocumentDetail> changeCover(@PathVariable Long id,
    @Valid @RequestBody DocumentCoverRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(documentService.changeCover(id, request.cover(), userId));
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
