package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.dto.TrashResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trash")
@RequiredArgsConstructor
public class TrashController {

  private final DocumentService documentService;

  @GetMapping
  public ApiResponse<TrashResponse> trash() {
    return ApiResponse.ok(documentService.findTrash());
  }
}
