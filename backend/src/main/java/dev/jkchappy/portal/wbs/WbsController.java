package dev.jkchappy.portal.wbs;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import dev.jkchappy.portal.wbs.dto.WbsResponse;
import dev.jkchappy.portal.wbs.dto.WbsTaskCreateRequest;
import dev.jkchappy.portal.wbs.dto.WbsTaskMoveRequest;
import dev.jkchappy.portal.wbs.dto.WbsTaskUpdateRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wbs")
@RequiredArgsConstructor
public class WbsController {

  private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

  private final WbsService wbsService;
  private final Clock clock;

  // 기준일이 없으면 한국 날짜 오늘
  @GetMapping("/{documentId}")
  public ApiResponse<WbsResponse> get(@PathVariable Long documentId,
    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate baseDate,
    @CurrentUser Long userId) {
    LocalDate resolved = baseDate == null ? LocalDate.now(clock.withZone(KOREA)) : baseDate;
    return ApiResponse.ok(wbsService.get(documentId, resolved));
  }

  @PostMapping("/{documentId}/tasks")
  public ApiResponse<Long> createTask(@PathVariable Long documentId,
    @Valid @RequestBody(required = false) WbsTaskCreateRequest request, @CurrentUser Long userId) {
    Long parentId = request == null ? null : request.parentId();
    Integer index = request == null ? null : request.index();
    return ApiResponse.ok(wbsService.createTask(documentId, parentId, index, userId));
  }

  @PutMapping("/tasks/{taskId}")
  public ApiResponse<Void> updateTask(@PathVariable Long taskId,
    @Valid @RequestBody WbsTaskUpdateRequest request, @CurrentUser Long userId) {
    wbsService.updateTask(taskId, request, userId);
    return ApiResponse.ok(null);
  }

  @PatchMapping("/tasks/{taskId}/position")
  public ApiResponse<Void> moveTask(@PathVariable Long taskId,
    @Valid @RequestBody WbsTaskMoveRequest request, @CurrentUser Long userId) {
    wbsService.moveTask(taskId, request.parentId(), request.index(), userId);
    return ApiResponse.ok(null);
  }

  @DeleteMapping("/tasks/{taskId}")
  public ApiResponse<Void> deleteTask(@PathVariable Long taskId, @CurrentUser Long userId) {
    wbsService.deleteTask(taskId, userId);
    return ApiResponse.ok(null);
  }
}
