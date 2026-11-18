package dev.jkchappy.portal.cs;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.cs.dto.NewCsListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cs")
@RequiredArgsConstructor
public class CsController {

  private final CsService csService;

  @GetMapping("/new")
  public ApiResponse<NewCsListResponse> listNew() {
    return ApiResponse.ok(csService.findNew());
  }
}
