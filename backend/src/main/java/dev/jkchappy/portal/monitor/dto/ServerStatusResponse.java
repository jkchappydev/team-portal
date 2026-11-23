package dev.jkchappy.portal.monitor.dto;

import java.time.OffsetDateTime;
import java.util.List;

// 메인 화면 모니터링 칸: 포털 서버 자원 (읽을 수 없는 값은 null, available이 false면 서버 정보를 못 읽음)
public record ServerStatusResponse(boolean available, String serverName, Double cpuPercent, Integer cpuCores,
  Long memoryUsedBytes, Long memoryTotalBytes, Long uptimeSeconds, List<Disk> disks, OffsetDateTime checkedAt) {

  public record Disk(String name, long usedBytes, long totalBytes) {
  }
}
