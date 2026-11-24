package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.monitor.dto.ServerHistoryResponse;
import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/monitor")
@RequiredArgsConstructor
public class MonitorController {

  private final ServerMonitorService serverMonitorService;
  private final RemoteServerMonitor remoteServerMonitor;
  private final ServiceCheckService serviceCheckService;
  private final MetricHistoryService metricHistoryService;

  // 포털 서버를 맨 앞에, 그 뒤로 설정한 다른 운영 서버들의 자원
  @GetMapping("/servers")
  public ApiResponse<List<ServerStatusResponse>> servers() {
    List<ServerStatusResponse> result = new ArrayList<>();
    result.add(serverMonitorService.status());
    result.addAll(remoteServerMonitor.statuses());
    return ApiResponse.ok(result);
  }

  // 애플리케이션·DB 동작 상태 (30초마다 확인한 마지막 결과)
  @GetMapping("/services")
  public ApiResponse<ServiceStatusResponse> services() {
    return ApiResponse.ok(serviceCheckService.status());
  }

  // 서버 하나의 CPU·메모리·네트워크 사용 기록 (range: 1h, 6h, 24h, 7d)
  @GetMapping("/history")
  public ApiResponse<ServerHistoryResponse> history(@RequestParam String server,
    @RequestParam(defaultValue = "1h") String range) {
    return ApiResponse.ok(metricHistoryService.history(server, MetricHistoryService.Range.of(range)));
  }
}
