package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.monitor.dto.ServerHistoryResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 모니터링 사용 기록: 1분마다 서버별 CPU·메모리 사용률과 네트워크 초당 전송량을 저장하고 기간별로 묶어 조회
// CPU·네트워크는 직전 기록과의 누적값 차이라 1분 평균 (서버를 처음 읽거나 다시 읽기 시작한 첫 1분은 기록하지 않음)
@Slf4j
@Service
public class MetricHistoryService {

  // 기록을 남겨 두는 기간
  static final Duration RETENTION = Duration.ofDays(7);

  // 화면의 기간 버튼과 그 기간을 나누는 간격 (점이 60~170개 정도가 되도록)
  public enum Range {
    HOUR_1("1h", Duration.ofHours(1), Duration.ofMinutes(1)),
    HOUR_6("6h", Duration.ofHours(6), Duration.ofMinutes(5)),
    HOUR_24("24h", Duration.ofHours(24), Duration.ofMinutes(15)),
    DAY_7("7d", Duration.ofDays(7), Duration.ofHours(1));

    private final String code;
    private final Duration length;
    private final Duration bucket;

    Range(String code, Duration length, Duration bucket) {
      this.code = code;
      this.length = length;
      this.bucket = bucket;
    }

    public static Range of(String code) {
      return Arrays.stream(values()).filter(r -> r.code.equals(code)).findFirst()
        .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT, "기간은 1h, 6h, 24h, 7d 중 하나입니다."));
    }
  }

  private final ServerMonitorService serverMonitorService;
  private final RemoteServerMonitor remoteServerMonitor;
  private final ServerMetricSampleRepository repository;
  private final Clock clock;
  // 서버별 직전 기록 시점의 값
  private final Map<String, MetricCounters> previous = new ConcurrentHashMap<>();

  public MetricHistoryService(ServerMonitorService serverMonitorService, RemoteServerMonitor remoteServerMonitor,
    ServerMetricSampleRepository repository, Clock clock) {
    this.serverMonitorService = serverMonitorService;
    this.remoteServerMonitor = remoteServerMonitor;
    this.repository = repository;
    this.clock = clock;
  }

  @Scheduled(initialDelay = 60_000, fixedRate = 60_000)
  @Transactional
  public void record() {
    Map<String, MetricCounters> current = new LinkedHashMap<>();
    current.put(serverMonitorService.serverName(), serverMonitorService.counters());
    current.putAll(remoteServerMonitor.counters());
    List<ServerMetricSample> samples = new ArrayList<>();
    for (Map.Entry<String, MetricCounters> entry : current.entrySet()) {
      MetricCounters before = previous.put(entry.getKey(), entry.getValue());
      ServerMetricSample sample = toSample(entry.getKey(), before, entry.getValue());
      if (sample != null) {
        samples.add(sample);
      }
    }
    // 이번에 읽지 못한 서버는 다음에 다시 읽히면 그때부터 새로 시작
    previous.keySet().retainAll(current.keySet());
    repository.saveAll(samples);
  }

  // 직전 값이 없거나 너무 오래됐으면(서버가 한동안 안 읽힘) 평균을 낼 수 없어 null
  static ServerMetricSample toSample(String serverName, MetricCounters before, MetricCounters after) {
    if (before == null || Duration.between(before.at(), after.at()).compareTo(Duration.ofMinutes(5)) > 0) {
      return null;
    }
    Double cpu = after.cpuPercent();
    if (before.cpu() != null && after.cpu() != null) {
      cpu = ProcStats.cpuPercent(before.cpu(), after.cpu());
    }
    ProcStats.NetRate rate = before.network() != null && after.network() != null
      ? ProcStats.netRate(before.network(), before.at(), after.network(), after.at()) : null;
    if (cpu == null && after.memoryPercent() == null && rate == null) {
      return null;
    }
    return ServerMetricSample.create(serverName, after.at(), cpu, after.memoryPercent(),
      rate == null ? null : rate.rxBytesPerSec(), rate == null ? null : rate.txBytesPerSec());
  }

  // 매시 정각 5분에 보관 기간이 지난 기록 삭제
  @Scheduled(cron = "0 5 * * * *")
  @Transactional
  public void purge() {
    int deleted = repository.deleteOlderThan(clock.instant().minus(RETENTION));
    if (deleted > 0) {
      log.debug("모니터링 사용 기록 {}건 삭제", deleted);
    }
  }

  @Transactional(readOnly = true)
  public ServerHistoryResponse history(String serverName, Range range) {
    Instant to = clock.instant();
    Instant from = to.minus(range.length);
    List<ServerMetricSample> samples =
      repository.findByServerNameAndSampledAtGreaterThanEqualOrderBySampledAtAsc(serverName, from);
    long bucketSeconds = range.bucket.toSeconds();
    // 구간 시작(간격의 배수 시각)별로 모음, 시간순 유지
    Map<Long, List<ServerMetricSample>> buckets = new LinkedHashMap<>();
    for (ServerMetricSample sample : samples) {
      long start = Math.floorDiv(sample.getSampledAt().getEpochSecond(), bucketSeconds) * bucketSeconds;
      buckets.computeIfAbsent(start, key -> new ArrayList<>()).add(sample);
    }
    List<ServerHistoryResponse.Point> points = buckets.entrySet().stream()
      .map(entry -> new ServerHistoryResponse.Point(at(Instant.ofEpochSecond(entry.getKey())),
        average(entry.getValue(), ServerMetricSample::getCpuPercent),
        average(entry.getValue(), ServerMetricSample::getMemoryPercent),
        average(entry.getValue(), ServerMetricSample::getRxBytesPerSec),
        average(entry.getValue(), ServerMetricSample::getTxBytesPerSec)))
      .toList();
    return new ServerHistoryResponse(serverName, range.code, at(from), at(to), bucketSeconds, points);
  }

  private OffsetDateTime at(Instant instant) {
    return OffsetDateTime.ofInstant(instant, clock.getZone());
  }

  private static Double average(List<ServerMetricSample> samples, Function<ServerMetricSample, Double> value) {
    double sum = 0;
    int count = 0;
    for (ServerMetricSample sample : samples) {
      Double v = value.apply(sample);
      if (v != null) {
        sum += v;
        count++;
      }
    }
    return count == 0 ? null : sum / count;
  }
}
