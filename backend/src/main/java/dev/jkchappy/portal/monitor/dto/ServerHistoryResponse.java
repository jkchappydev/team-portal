package dev.jkchappy.portal.monitor.dto;

import java.time.OffsetDateTime;
import java.util.List;

// 모니터링 사용 기록: 기간(from~to)을 bucketSeconds 간격으로 나눠 구간마다 평균 (기록이 없는 구간은 빠짐)
public record ServerHistoryResponse(String serverName, String range, OffsetDateTime from, OffsetDateTime to,
  long bucketSeconds, List<Point> points) {

  // 구간 시작 시각과 그 구간 평균 (값이 하나도 없으면 null)
  public record Point(OffsetDateTime at, Double cpuPercent, Double memoryPercent, Double rxBytesPerSec,
    Double txBytesPerSec) {
  }
}
