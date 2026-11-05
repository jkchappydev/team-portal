package dev.jkchappy.portal.collab;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.member.CurrentUser;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/collab/tickets")
@RequiredArgsConstructor
public class CollabTicketController {
  private final CollabTicketService tickets;

  @PostMapping
  public ApiResponse<Map<String, String>> issue(@CurrentUser Long userId) {
    return ApiResponse.ok(Map.of("ticket", tickets.issue(userId)));
  }
}
