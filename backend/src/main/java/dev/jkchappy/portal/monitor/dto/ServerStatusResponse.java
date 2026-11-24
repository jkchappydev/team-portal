package dev.jkchappy.portal.monitor.dto;

import java.time.OffsetDateTime;
import java.util.List;

// 모니터링 칸: 서버 운영체제·자원 (읽을 수 없는 값은 null, available이 false면 서버 정보를 못 읽음)
// 네트워크는 서버 밖과 주고받은 초당 바이트(수신·송신), 첫 측정 직후나 읽을 수 없으면 null
public record ServerStatusResponse(boolean available, String serverName, String osName, String kernel, Double cpuPercent, Integer cpuCores,
  Long memoryUsedBytes, Long memoryTotalBytes, Long uptimeSeconds, List<Disk> disks, Double networkRxBytesPerSec, Double networkTxBytesPerSec,
  OffsetDateTime checkedAt) {

  public record Disk(String name, long usedBytes, long totalBytes) {
  }
}
