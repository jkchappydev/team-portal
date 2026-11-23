package dev.jkchappy.portal.monitor.dto;

import java.time.OffsetDateTime;
import java.util.List;

// 모니터링 상세 화면: 애플리케이션·DB 동작 상태 (마지막으로 확인한 결과, 아직 확인 전이면 checkedAt이 null)
public record ServiceStatusResponse(OffsetDateTime checkedAt, PortalDatabase portalDatabase, List<Check> apps,
  List<Check> databases) {

  // 주소 호출(HTTP) 또는 포트 연결(TCP) 결과, statusCode는 HTTP일 때만, server는 어느 운영 서버 것인지(없으면 포털 서버)
  public record Check(String server, String name, String target, String kind, boolean up, Integer statusCode,
    Long responseMs, String message) {
  }

  // 포털이 쓰는 DB에 직접 쿼리한 결과 (실패하면 up=false와 message만)
  public record PortalDatabase(boolean up, String version, Long responseMs, Integer connections, Long sizeBytes,
    String message) {
  }
}
