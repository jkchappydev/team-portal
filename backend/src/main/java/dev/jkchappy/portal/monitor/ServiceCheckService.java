package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

// 모니터링 상세 화면의 애플리케이션·DB 동작 확인
// 접속자 수만큼 다른 서비스를 두드리지 않도록 30초마다 한꺼번에 확인해 두고 화면은 마지막 결과만 읽음
@Slf4j
@Service
public class ServiceCheckService {

  private final List<MonitorTarget> targets;
  private final TargetProber prober;
  private final JdbcTemplate jdbcTemplate;
  private final Clock clock;
  private volatile ServiceStatusResponse latest;

  public ServiceCheckService(@Value("${app.monitor.targets:}") String targets, TargetProber prober,
    JdbcTemplate jdbcTemplate, Clock clock) {
    this.targets = MonitorTarget.parse(targets);
    this.prober = prober;
    this.jdbcTemplate = jdbcTemplate;
    this.clock = clock;
    this.latest = new ServiceStatusResponse(null, null, List.of(), List.of());
  }

  public ServiceStatusResponse status() {
    return latest;
  }

  // 대상마다 최대 5초라 한 줄씩 기다리지 않도록 동시에 확인
  @Scheduled(initialDelay = 3_000, fixedDelay = 30_000)
  public void refresh() {
    List<ServiceStatusResponse.Check> checks;
    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      List<Future<ServiceStatusResponse.Check>> futures = targets.stream()
        .map(target -> executor.submit(() -> prober.probe(target)))
        .toList();
      checks = futures.stream().map(ServiceCheckService::join).toList();
    }
    List<ServiceStatusResponse.Check> apps = pick(checks, MonitorTarget.Group.APP);
    List<ServiceStatusResponse.Check> databases = pick(checks, MonitorTarget.Group.DB);
    latest = new ServiceStatusResponse(OffsetDateTime.now(clock), checkPortalDatabase(), apps, databases);
  }

  private List<ServiceStatusResponse.Check> pick(List<ServiceStatusResponse.Check> checks, MonitorTarget.Group group) {
    // 확인 결과는 targets와 같은 순서
    return java.util.stream.IntStream.range(0, targets.size())
      .filter(i -> targets.get(i).group() == group)
      .mapToObj(checks::get)
      .toList();
  }

  private static ServiceStatusResponse.Check join(Future<ServiceStatusResponse.Check> future) {
    try {
      return future.get();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(e);
    } catch (java.util.concurrent.ExecutionException e) {
      throw new IllegalStateException(e.getCause());
    }
  }

  // 포털 DB(PostgreSQL)에 직접 쿼리: 버전, 응답 시간, 이 DB의 연결 수, 크기
  ServiceStatusResponse.PortalDatabase checkPortalDatabase() {
    long started = System.nanoTime();
    try {
      String version = jdbcTemplate.queryForObject("show server_version", String.class);
      long elapsed = Duration.ofNanos(System.nanoTime() - started).toMillis();
      Integer connections = jdbcTemplate.queryForObject(
        "select count(*) from pg_stat_activity where datname = current_database()", Integer.class);
      Long size = jdbcTemplate.queryForObject("select pg_database_size(current_database())", Long.class);
      // "17.6 (Debian 17.6-1.pgdg13+1)" 에서 버전 숫자만
      String shortVersion = version == null ? "" : version.split(" ")[0];
      return new ServiceStatusResponse.PortalDatabase(true, "PostgreSQL " + shortVersion, elapsed, connections, size, null);
    } catch (RuntimeException e) {
      log.warn("포털 DB 확인 실패: {}", e.getMessage());
      return new ServiceStatusResponse.PortalDatabase(false, null, null, null, null, "DB에 연결할 수 없습니다.");
    }
  }
}
