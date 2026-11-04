package dev.jkchappy.portal.attachment;

import dev.jkchappy.portal.attachment.dto.AttachmentResponse;
import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class AttachmentController {

  private final AttachmentService attachmentService;

  @PostMapping("/api/documents/{documentId}/attachments")
  public ApiResponse<AttachmentResponse> upload(@PathVariable Long documentId,
    @RequestParam("file") MultipartFile file,
    @RequestParam(defaultValue = "false") boolean inline, @CurrentUser Long userId) {
    return ApiResponse.ok(attachmentService.upload(documentId, file, inline, userId));
  }

  @GetMapping("/api/documents/{documentId}/attachments")
  public ApiResponse<List<AttachmentResponse>> list(@PathVariable Long documentId) {
    return ApiResponse.ok(attachmentService.list(documentId));
  }

  // 이미지는 본문 표시를 위해 inline, 그 외는 한글 파일명을 유지한 다운로드
  @GetMapping("/api/attachments/{id}/download")
  public ResponseEntity<Resource> download(@PathVariable Long id) {
    AttachmentService.Download download = attachmentService.download(id);
    Attachment attachment = download.attachment();
    String contentType = attachment.getContentType();
    // SVG는 스크립트를 포함할 수 있어 inline 대상에서 제외
    boolean image = contentType.startsWith("image/") && !contentType.startsWith("image/svg");
    ContentDisposition disposition = (image
      ? ContentDisposition.inline() : ContentDisposition.attachment())
      .filename(attachment.getOriginalName(), StandardCharsets.UTF_8).build();
    return ResponseEntity.ok()
      .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
      .header("X-Content-Type-Options", "nosniff")
      .contentType(MediaType.parseMediaType(contentType))
      .body(download.resource());
  }

  @DeleteMapping("/api/attachments/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    attachmentService.delete(id);
    return ApiResponse.ok(null);
  }
}
