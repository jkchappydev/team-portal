package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/monitor")
@RequiredArgsConstructor
public class MonitorController {

  private final ServerMonitorService serverMonitorService;

  @GetMapping("/server")
  public ApiResponse<ServerStatusResponse> server() {
    return ApiResponse.ok(serverMonitorService.status());
  }
}
