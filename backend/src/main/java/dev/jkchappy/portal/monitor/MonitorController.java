package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/monitor")
@RequiredArgsConstructor
public class MonitorController {

  private final ServerMonitorService serverMonitorService;
  private final ServiceCheckService serviceCheckService;

  @GetMapping("/server")
  public ApiResponse<ServerStatusResponse> server() {
    return ApiResponse.ok(serverMonitorService.status());
  }

  // 애플리케이션·DB 동작 상태 (30초마다 확인한 마지막 결과)
  @GetMapping("/services")
  public ApiResponse<ServiceStatusResponse> services() {
    return ApiResponse.ok(serviceCheckService.status());
  }
}
