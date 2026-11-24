package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

// 포털 서버가 아닌 다른 운영 서버의 자원 (리눅스는 node_exporter, 윈도우는 windows_exporter의 /metrics를 읽음)
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
  // 네트워크 전송량 계산용 직전 누적값, 사용 기록용 마지막으로 읽은 값
  private final Map<String, TimedNet> lastNet = new ConcurrentHashMap<>();
  private final Map<String, MetricCounters> latestCounters = new ConcurrentHashMap<>();

  private record TimedNet(ProcStats.NetBytes bytes, Instant at) {
  }

  public RemoteServerMonitor(@Value("${app.monitor.remote-servers:}") String servers, Clock clock) {
    this.servers = parse(servers);
    this.clock = clock;
  }

  // "이름=http://주소:9100/metrics"(윈도우는 :9182)를 ; 으로 나열, 형식이 맞지 않는 항목은 건너뜀
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

  // 사용 기록용: 설정 순서대로, 마지막 읽기에 성공한 서버만
  public Map<String, MetricCounters> counters() {
    Map<String, MetricCounters> result = new LinkedHashMap<>();
    for (RemoteServer server : servers) {
      MetricCounters counters = latestCounters.get(server.name());
      if (counters != null) {
        result.put(server.name(), counters);
      }
    }
    return result;
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
        forget(server.name());
        return unavailable(server);
      }
      text = response.body();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return unavailable(server);
    } catch (IOException | RuntimeException e) {
      log.debug("{} 서버 지표 읽기 실패: {}", server.name(), e.getMessage());
      forget(server.name());
      return unavailable(server);
    }
    return toStatus(server.name(), NodeExporterStats.from(text, clock.instant()));
  }

  private void forget(String name) {
    lastCpu.remove(name);
    lastNet.remove(name);
    latestCounters.remove(name);
  }

  ServerStatusResponse toStatus(String name, NodeExporterStats stats) {
    Instant now = clock.instant();
    latestCounters.put(name, new MetricCounters(now, stats.cpu(), null,
      MetricCounters.memoryPercent(stats.memoryTotalBytes(), stats.memoryAvailableBytes()), stats.network()));
    ProcStats.NetRate rate = null;
    if (stats.network() != null) {
      TimedNet before = lastNet.put(name, new TimedNet(stats.network(), now));
      rate = before == null ? null : ProcStats.netRate(before.bytes(), before.at(), stats.network(), now);
    }
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
      rate == null ? null : rate.rxBytesPerSec(), rate == null ? null : rate.txBytesPerSec(), OffsetDateTime.now(clock));
  }

  private ServerStatusResponse unavailable(RemoteServer server) {
    return new ServerStatusResponse(false, server.name(), null, null, null, null, null, null, null, List.of(), null, null,
      OffsetDateTime.now(clock));
  }
}
