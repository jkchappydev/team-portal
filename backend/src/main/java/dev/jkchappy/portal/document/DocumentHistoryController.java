package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.HistoryCheckpointRequest;
import dev.jkchappy.portal.document.dto.HistoryEntry;
import dev.jkchappy.portal.document.dto.HistoryVersion;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DocumentHistoryController {

  private final DocumentHistoryService documentHistoryService;

  @GetMapping("/api/documents/{id}/history")
  public ApiResponse<List<HistoryEntry>> list(@PathVariable Long id, @CurrentUser Long userId) {
    return ApiResponse.ok(documentHistoryService.findHistory(id));
  }

  @GetMapping("/api/documents/{id}/history/{snapshotId}")
  public ApiResponse<HistoryVersion> get(@PathVariable Long id, @PathVariable Long snapshotId,
    @CurrentUser Long userId) {
    return ApiResponse.ok(documentHistoryService.getVersion(id, snapshotId));
  }

  @PostMapping("/api/documents/{id}/history")
  public ApiResponse<HistoryEntry> checkpoint(@PathVariable Long id,
    @Valid @RequestBody HistoryCheckpointRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(documentHistoryService.saveCheckpoint(id, request.contentState(), userId));
  }
}
