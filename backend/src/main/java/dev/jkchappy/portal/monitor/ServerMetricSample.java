package dev.jkchappy.portal.monitor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 서버 하나의 1분 사용 기록 (읽지 못한 값은 null)
@Entity
@Table(name = "server_metric_sample")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ServerMetricSample {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "server_name", nullable = false, length = 200, updatable = false)
  private String serverName;

  @Column(name = "sampled_at", nullable = false, updatable = false)
  private Instant sampledAt;

  @Column(name = "cpu_percent", updatable = false)
  private Double cpuPercent;

  @Column(name = "memory_percent", updatable = false)
  private Double memoryPercent;

  @Column(name = "rx_bytes_per_sec", updatable = false)
  private Double rxBytesPerSec;

  @Column(name = "tx_bytes_per_sec", updatable = false)
  private Double txBytesPerSec;

  public static ServerMetricSample create(String serverName, Instant sampledAt, Double cpuPercent, Double memoryPercent,
    Double rxBytesPerSec, Double txBytesPerSec) {
    ServerMetricSample sample = new ServerMetricSample();
    sample.serverName = serverName;
    sample.sampledAt = sampledAt;
    sample.cpuPercent = cpuPercent;
    sample.memoryPercent = memoryPercent;
    sample.rxBytesPerSec = rxBytesPerSec;
    sample.txBytesPerSec = txBytesPerSec;
    return sample;
  }
}
