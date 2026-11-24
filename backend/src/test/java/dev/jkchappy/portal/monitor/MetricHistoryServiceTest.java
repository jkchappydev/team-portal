package dev.jkchappy.portal.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.monitor.dto.ServerHistoryResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class MetricHistoryServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-24T01:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneId.of("Asia/Seoul"));

  @Autowired
  private ServerMetricSampleRepository repository;

  private ServerMonitorService portal;
  private RemoteServerMonitor remote;
  private MetricHistoryService service;

  @BeforeEach
  void setUp() {
    portal = mock(ServerMonitorService.class);
    remote = mock(RemoteServerMonitor.class);
    when(portal.serverName()).thenReturn("포털");
    service = new MetricHistoryService(portal, remote, repository, CLOCK);
  }

  private static MetricCounters counters(Instant at, long cpuTotal, long cpuIdle, long rx, long tx) {
    return new MetricCounters(at, new ProcStats.CpuTimes(cpuTotal, cpuIdle), null, 40.0, new ProcStats.NetBytes(rx, tx));
  }

  @Test
  void toSample_averagesCpuAndNetworkOverTheMinute() {
    Instant t0 = NOW.minusSeconds(60);

    ServerMetricSample sample = MetricHistoryService.toSample("포털",
      counters(t0, 1000, 800, 0, 0), counters(NOW, 2000, 1550, 60_000, 6_000));

    // 1분 동안 CPU 1000 중 쉬는 시간 750 -> 25%, 초당 1000바이트 받고 100바이트 보냄
    assertThat(sample.getCpuPercent()).isEqualTo(25.0);
    assertThat(sample.getMemoryPercent()).isEqualTo(40.0);
    assertThat(sample.getRxBytesPerSec()).isEqualTo(1000.0);
    assertThat(sample.getTxBytesPerSec()).isEqualTo(100.0);
    assertThat(sample.getSampledAt()).isEqualTo(NOW);
  }

  @Test
  void toSample_skipsFirstReadAndLongGaps() {
    assertThat(MetricHistoryService.toSample("포털", null, counters(NOW, 1, 1, 1, 1))).isNull();
    assertThat(MetricHistoryService.toSample("포털", counters(NOW.minusSeconds(600), 1, 1, 1, 1),
      counters(NOW, 2, 1, 2, 2))).isNull();
  }

  @Test
  void toSample_usesInstantCpuPercentWhenCountersAreMissing() {
    MetricCounters before = new MetricCounters(NOW.minusSeconds(60), null, 10.0, 50.0, null);
    MetricCounters after = new MetricCounters(NOW, null, 30.0, 55.0, null);

    ServerMetricSample sample = MetricHistoryService.toSample("개발 PC", before, after);

    assertThat(sample.getCpuPercent()).isEqualTo(30.0);
    assertThat(sample.getRxBytesPerSec()).isNull();
  }

  @Test
  void record_savesFromSecondRoundAndOnlyForServersReadBothTimes() {
    AtomicReference<MetricCounters> portalNow = new AtomicReference<>(counters(NOW.minusSeconds(60), 100, 50, 0, 0));
    when(portal.counters()).thenAnswer(invocation -> portalNow.get());
    Map<String, MetricCounters> remoteNow = new LinkedHashMap<>();
    remoteNow.put("원격", counters(NOW.minusSeconds(60), 100, 50, 0, 0));
    when(remote.counters()).thenAnswer(invocation -> new LinkedHashMap<>(remoteNow));

    service.record();
    assertThat(repository.count()).isZero();

    // 두 번째에는 원격 서버를 읽지 못함
    portalNow.set(counters(NOW, 200, 100, 600, 600));
    remoteNow.clear();
    service.record();

    assertThat(repository.findAll()).extracting(ServerMetricSample::getServerName).containsExactly("포털");
  }

  @Test
  void history_averagesSamplesPerBucketAndDropsOlderThanRange() {
    // 5분 간격 구간: 00:50~00:55에 두 개, 00:55~01:00에 하나, 6시간보다 오래된 것 하나
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(9 * 60), 10.0, 50.0, 100.0, null));
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(8 * 60), 30.0, 60.0, 300.0, null));
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(2 * 60), 5.0, 70.0, null, null));
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(7 * 3600), 99.0, 99.0, 99.0, 99.0));
    repository.save(ServerMetricSample.create("다른 서버", NOW.minusSeconds(60), 1.0, 1.0, 1.0, 1.0));

    ServerHistoryResponse history = service.history("서버", MetricHistoryService.Range.HOUR_6);

    assertThat(history.bucketSeconds()).isEqualTo(300);
    assertThat(history.points()).hasSize(2);
    ServerHistoryResponse.Point first = history.points().getFirst();
    assertThat(first.at().toInstant()).isEqualTo(Instant.parse("2026-11-24T00:50:00Z"));
    assertThat(first.cpuPercent()).isEqualTo(20.0);
    assertThat(first.memoryPercent()).isEqualTo(55.0);
    assertThat(first.rxBytesPerSec()).isEqualTo(200.0);
    assertThat(first.txBytesPerSec()).isNull();
    assertThat(history.points().get(1).cpuPercent()).isEqualTo(5.0);
  }

  @Test
  void purge_deletesSamplesOlderThanSevenDays() {
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(8 * 86_400), 1.0, 1.0, null, null));
    repository.save(ServerMetricSample.create("서버", NOW.minusSeconds(86_400), 2.0, 2.0, null, null));

    service.purge();

    assertThat(repository.findAll()).extracting(ServerMetricSample::getCpuPercent).containsExactly(2.0);
  }

  @Test
  void range_rejectsUnknownCode() {
    assertThat(MetricHistoryService.Range.of("7d")).isEqualTo(MetricHistoryService.Range.DAY_7);
    assertThatThrownBy(() -> MetricHistoryService.Range.of("3d")).isInstanceOf(BusinessException.class);
  }
}
