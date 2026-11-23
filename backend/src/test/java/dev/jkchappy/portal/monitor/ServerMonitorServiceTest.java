package dev.jkchappy.portal.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ServerMonitorServiceTest {

  private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-23T06:00:00Z"), ZoneId.of("Asia/Seoul"));

  @TempDir
  Path proc;

  private void writeProc(String stat) throws IOException {
    Files.writeString(proc.resolve("stat"), stat);
    Files.writeString(proc.resolve("meminfo"), "MemTotal:       16000 kB\nMemFree:  1000 kB\nMemAvailable:    6000 kB\n");
    Files.writeString(proc.resolve("uptime"), "86500.42 300000.10\n");
  }

  @Test
  void parseCpu_sumsFirstEightValuesAndTreatsIowaitAsIdle() {
    ProcStats.CpuTimes times = ProcStats.parseCpu("cpu  10 0 10 70 10 0 0 0 5 0\ncpu0 1 2 3 4\n");

    assertThat(times.total()).isEqualTo(100);
    assertThat(times.idle()).isEqualTo(80);
  }

  @Test
  void parseCpu_rejectsMissingCpuLine() {
    assertThatThrownBy(() -> ProcStats.parseCpu("intr 1 2 3")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void status_readsMemoryUptimeAndCpuBetweenSamples() throws IOException {
    ServerMonitorService service = new ServerMonitorService(proc.toString(), "테스트 서버", "데이터=" + proc, CLOCK);
    writeProc("cpu  100 0 100 800 0 0 0 0\n");
    service.sampleCpu();
    // 두 번째 측정까지 사용 200, 쉬는 시간 800 증가 -> 20%
    writeProc("cpu  200 0 200 1600 0 0 0 0\n");
    service.sampleCpu();

    ServerStatusResponse status = service.status();

    assertThat(status.available()).isTrue();
    assertThat(status.serverName()).isEqualTo("테스트 서버");
    assertThat(status.cpuPercent()).isEqualTo(20.0);
    assertThat(status.memoryTotalBytes()).isEqualTo(16000L * 1024);
    assertThat(status.memoryUsedBytes()).isEqualTo(10000L * 1024);
    assertThat(status.uptimeSeconds()).isEqualTo(86500L);
    assertThat(status.disks()).singleElement().satisfies(disk -> {
      assertThat(disk.name()).isEqualTo("데이터");
      assertThat(disk.totalBytes()).isPositive();
    });
  }

  @Test
  void status_fallsBackToJvmOperatingSystemValuesWhenProcIsMissing() {
    ServerMonitorService service = new ServerMonitorService(proc.resolve("none").toString(), "", "", CLOCK);
    service.sampleCpu();

    ServerStatusResponse status = service.status();

    // 개발 PC(Windows 등)처럼 /proc가 없으면 JVM이 주는 메모리로 보여 주고 가동 시간은 비움
    assertThat(status.available()).isTrue();
    assertThat(status.serverName()).isEqualTo("포털 서버");
    assertThat(status.memoryTotalBytes()).isPositive();
    assertThat(status.memoryUsedBytes()).isBetween(0L, status.memoryTotalBytes());
    assertThat(status.uptimeSeconds()).isNull();
  }

  @Test
  void parseDisks_skipsMalformedItemsAndDefaultsToRoot() {
    assertThat(ServerMonitorService.parseDisks("시스템=/a, 잘못된값 ,데이터=/b"))
      .extracting(ServerMonitorService.DiskTarget::name).containsExactly("시스템", "데이터");
    assertThat(ServerMonitorService.parseDisks(" ")).singleElement()
      .satisfies(d -> assertThat(d.path()).isEqualTo("/"));
  }
}
