package dev.jkchappy.portal.monitor;

import java.time.Instant;

// 사용 기록용 한 시점의 서버 값: CPU·네트워크는 누적값이라 직전 기록과의 차이로 사용률·전송량을 계산
// cpu 누적값을 못 읽는 경우(개발 PC)는 cpuPercent에 그 순간 사용률, 읽지 못한 값은 null
record MetricCounters(Instant at, ProcStats.CpuTimes cpu, Double cpuPercent, Double memoryPercent,
  ProcStats.NetBytes network) {

  static Double memoryPercent(Long totalBytes, Long availableBytes) {
    if (totalBytes == null || availableBytes == null || totalBytes <= 0) {
      return null;
    }
    return (totalBytes - availableBytes) * 100.0 / totalBytes;
  }
}
