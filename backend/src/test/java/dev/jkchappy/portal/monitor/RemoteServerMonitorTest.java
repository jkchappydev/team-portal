package dev.jkchappy.portal.monitor;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class RemoteServerMonitorTest {

  private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-23T06:00:00Z"), ZoneId.of("Asia/Seoul"));

  // node_exporter /metrics 형식 (CPU 2개, 디스크는 / 와 /var, 부팅 영역·스냅 패키지는 제외 대상)
  private static String metrics(double busy0, double idle0) {
    return """
      # HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.
      # TYPE node_cpu_seconds_total counter
      node_cpu_seconds_total{cpu="0",mode="idle"} %s
      node_cpu_seconds_total{cpu="0",mode="user"} %s
      node_cpu_seconds_total{cpu="1",mode="idle"} 100
      node_cpu_seconds_total{cpu="1",mode="iowait"} 0
      node_memory_MemTotal_bytes 1.6e+10
      node_memory_MemAvailable_bytes 6e+09
      node_boot_time_seconds 1.7e+09
      node_time_seconds 1.7000864e+09
      node_os_info{id="rocky",pretty_name="Rocky Linux 8.10 (Green Obsidian)",version_id="8.10"} 1
      node_uname_info{nodename="deploy",release="4.18.0-553.el8_10.x86_64",sysname="Linux"} 1
      node_filesystem_size_bytes{device="/dev/xvda2",fstype="xfs",mountpoint="/"} 1.7e+10
      node_filesystem_avail_bytes{device="/dev/xvda2",fstype="xfs",mountpoint="/"} 5e+09
      node_filesystem_size_bytes{device="/dev/mapper/vg-var",fstype="xfs",mountpoint="/var"} 4e+11
      node_filesystem_avail_bytes{device="/dev/mapper/vg-var",fstype="xfs",mountpoint="/var"} 3e+11
      node_filesystem_size_bytes{device="/dev/xvda1",fstype="xfs",mountpoint="/boot"} 1e+09
      node_filesystem_avail_bytes{device="/dev/xvda1",fstype="xfs",mountpoint="/boot"} 6e+08
      node_filesystem_size_bytes{device="/dev/loop0",fstype="squashfs",mountpoint="/var/lib/snapd/snap/core/1"} 1e+08
      node_filesystem_avail_bytes{device="/dev/loop0",fstype="squashfs",mountpoint="/var/lib/snapd/snap/core/1"} 0
      node_filesystem_size_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 8e+09
      node_filesystem_avail_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 8e+09
      """.formatted(idle0, busy0);
  }

  @Test
  void from_readsMemoryUptimeOsAndRealDisksOnly() {
    NodeExporterStats stats = NodeExporterStats.from(metrics(0, 100));

    assertThat(stats.cpuCores()).isEqualTo(2);
    assertThat(stats.memoryTotalBytes()).isEqualTo(16_000_000_000L);
    assertThat(stats.memoryAvailableBytes()).isEqualTo(6_000_000_000L);
    assertThat(stats.uptimeSeconds()).isEqualTo(86_400L);
    assertThat(stats.osName()).isEqualTo("Rocky Linux 8.10 (Green Obsidian)");
    assertThat(stats.kernel()).isEqualTo("4.18.0-553.el8_10.x86_64");
    assertThat(stats.filesystems()).extracting(NodeExporterStats.Filesystem::mountpoint).containsExactly("/", "/var");
  }

  @Test
  void parse_skipsCommentsAndNonNumericValues() {
    var samples = NodeExporterStats.parse("# HELP x\nfoo 1\nbar{a=\"b \\\"q\\\"\"} 2.5\nbaz NaN-ish\n\n");

    assertThat(samples).extracting(NodeExporterStats.Sample::name).containsExactly("foo", "bar");
    assertThat(samples.get(1).labels()).containsEntry("a", "b \"q\"");
  }

  @Test
  void refresh_readsServersAndComputesCpuFromConsecutiveReads() throws IOException {
    AtomicReference<String> body = new AtomicReference<>(metrics(0, 100));
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/metrics", exchange -> {
      byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, bytes.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(bytes);
      }
    });
    server.start();
    try {
      String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/metrics";
      RemoteServerMonitor monitor = new RemoteServerMonitor("운영=" + url + "; 꺼진 서버=http://127.0.0.1:1/metrics", CLOCK);

      monitor.refresh();
      ServerStatusResponse first = monitor.statuses().getFirst();
      assertThat(first.available()).isTrue();
      assertThat(first.cpuPercent()).isNull();

      // 두 번째 읽기까지 cpu0이 사용 30초, 쉬는 시간 10초 늘어남 (cpu1은 그대로) -> 75%
      body.set(metrics(30, 110));
      monitor.refresh();
      ServerStatusResponse second = monitor.statuses().getFirst();

      assertThat(second.serverName()).isEqualTo("운영");
      assertThat(second.cpuPercent()).isEqualTo(75.0);
      assertThat(second.memoryUsedBytes()).isEqualTo(10_000_000_000L);
      assertThat(second.disks()).extracting(ServerStatusResponse.Disk::name).containsExactly("/", "/var");
      assertThat(second.disks().getFirst().usedBytes()).isEqualTo(12_000_000_000L);
      ServerStatusResponse down = monitor.statuses().get(1);
      assertThat(down.serverName()).isEqualTo("꺼진 서버");
      assertThat(down.available()).isFalse();
    } finally {
      server.stop(0);
    }
  }

  @Test
  void parse_skipsMalformedServerItems() {
    assertThat(RemoteServerMonitor.parse("가=http://a:9100/metrics;잘못;나=ftp://b;=http://c"))
      .extracting(RemoteServerMonitor.RemoteServer::name).containsExactly("가");
  }
}
