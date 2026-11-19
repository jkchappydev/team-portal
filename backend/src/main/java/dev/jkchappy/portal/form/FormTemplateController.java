package dev.jkchappy.portal.form;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.form.dto.FormPositionRequest;
import dev.jkchappy.portal.form.dto.FormResponse;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// 팀 스페이스 "양식" (팀원 모두가 같은 목록을 보고 올리기·미리보기·내려받기·삭제)
@RestController
@RequestMapping("/api/forms")
@RequiredArgsConstructor
public class FormTemplateController {

  private final FormTemplateService formService;

  @GetMapping
  public ApiResponse<List<FormResponse>> list(@CurrentUser Long userId) {
    return ApiResponse.ok(formService.findAll());
  }

  @PostMapping
  public ApiResponse<FormResponse> upload(@RequestParam("file") MultipartFile file, @CurrentUser Long userId) {
    return ApiResponse.ok(formService.upload(file, userId));
  }

  // 끌어 옮긴 양식 순서 변경
  @PatchMapping("/{id}/position")
  public ApiResponse<Void> move(@PathVariable Long id, @Valid @RequestBody FormPositionRequest request,
    @CurrentUser Long userId) {
    formService.move(id, request.index());
    return ApiResponse.ok(null);
  }

  // 미리보기는 화면이 내용을 받아 그리므로 항상 한글 파일명을 유지한 다운로드로 보냄
  @GetMapping("/{id}/download")
  public ResponseEntity<Resource> download(@PathVariable Long id, @CurrentUser Long userId) {
    FormTemplateService.Download file = formService.download(id);
    FormTemplate form = file.form();
    ContentDisposition disposition = ContentDisposition.attachment()
      .filename(form.getOriginalName(), StandardCharsets.UTF_8).build();
    return ResponseEntity.ok()
      .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
      .header("X-Content-Type-Options", "nosniff")
      .contentType(MediaType.parseMediaType(form.getContentType()))
      .body(file.resource());
  }

  // 휴지통으로 이동 (영구 삭제는 휴지통 화면에서 /api/trash/forms/{id})
  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    formService.delete(id);
    return ApiResponse.ok(null);
  }

  // 휴지통에서 되살리기
  @PostMapping("/{id}/restore")
  public ApiResponse<Void> restore(@PathVariable Long id, @CurrentUser Long userId) {
    formService.restore(id);
    return ApiResponse.ok(null);
  }
}
