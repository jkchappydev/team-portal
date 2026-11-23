package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

// 포털 서버가 아닌 다른 운영 서버의 자원 (각 서버 node_exporter의 /metrics를 읽음)
// 접속자마다 다른 서버를 부르지 않도록 5초마다 읽어 두고, CPU 사용률은 직전 읽기와의 차이로 계산
@Slf4j
@Service
public class RemoteServerMonitor {

  static final Duration TIMEOUT = Duration.ofSeconds(3);

  record RemoteServer(String name, String metricsUrl) {
  }

  private final List<RemoteServer> servers;
  private final Clock clock;
  private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
  private final Map<String, ProcStats.CpuTimes> lastCpu = new ConcurrentHashMap<>();
  private final Map<String, ServerStatusResponse> latest = new ConcurrentHashMap<>();

  public RemoteServerMonitor(@Value("${app.monitor.remote-servers:}") String servers, Clock clock) {
    this.servers = parse(servers);
    this.clock = clock;
  }

  // "이름=http://주소:9100/metrics"를 ; 으로 나열, 형식이 맞지 않는 항목은 건너뜀
  static List<RemoteServer> parse(String value) {
    List<RemoteServer> result = new ArrayList<>();
    for (String item : value.split(";")) {
      String trimmed = item.trim();
      int eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      String url = trimmed.substring(eq + 1).trim();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        result.add(new RemoteServer(trimmed.substring(0, eq).trim(), url));
      }
    }
    return List.copyOf(result);
  }

  // 설정 순서대로, 아직 한 번도 못 읽은 서버는 읽는 중(available=false, 값 없음)
  public List<ServerStatusResponse> statuses() {
    return servers.stream()
      .map(server -> latest.getOrDefault(server.name(), unavailable(server)))
      .toList();
  }

  @Scheduled(initialDelay = 1_000, fixedRate = 5_000)
  public void refresh() {
    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      for (RemoteServer server : servers) {
        executor.submit(() -> latest.put(server.name(), read(server)));
      }
    }
  }

  ServerStatusResponse read(RemoteServer server) {
    String text;
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(server.metricsUrl())).timeout(TIMEOUT).GET().build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        return unavailable(server);
      }
      text = response.body();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return unavailable(server);
    } catch (IOException | RuntimeException e) {
      log.debug("{} 서버 지표 읽기 실패: {}", server.name(), e.getMessage());
      lastCpu.remove(server.name());
      return unavailable(server);
    }
    return toStatus(server.name(), NodeExporterStats.from(text));
  }

  ServerStatusResponse toStatus(String name, NodeExporterStats stats) {
    Double cpuPercent = null;
    if (stats.cpu() != null) {
      ProcStats.CpuTimes before = lastCpu.put(name, stats.cpu());
      cpuPercent = before == null ? null : ProcStats.cpuPercent(before, stats.cpu());
    }
    Long used = stats.memoryTotalBytes() != null && stats.memoryAvailableBytes() != null
      ? stats.memoryTotalBytes() - stats.memoryAvailableBytes() : null;
    List<ServerStatusResponse.Disk> disks = stats.filesystems().stream()
      .map(fs -> new ServerStatusResponse.Disk(fs.mountpoint(), fs.sizeBytes() - fs.availableBytes(), fs.sizeBytes()))
      .toList();
    return new ServerStatusResponse(true, name, stats.osName(), stats.kernel(), cpuPercent,
      stats.cpuCores() > 0 ? stats.cpuCores() : null, used, stats.memoryTotalBytes(), stats.uptimeSeconds(), disks,
      OffsetDateTime.now(clock));
  }

  private ServerStatusResponse unavailable(RemoteServer server) {
    return new ServerStatusResponse(false, server.name(), null, null, null, null, null, null, null, List.of(),
      OffsetDateTime.now(clock));
  }
}
