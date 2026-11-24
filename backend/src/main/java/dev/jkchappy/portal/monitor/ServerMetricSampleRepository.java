package dev.jkchappy.portal.monitor;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServerMetricSampleRepository extends JpaRepository<ServerMetricSample, Long> {

  // 서버 하나의 기간 안 기록을 시간순으로 조회
  List<ServerMetricSample> findByServerNameAndSampledAtGreaterThanEqualOrderBySampledAtAsc(String serverName,
    Instant from);

  // 보관 기간이 지난 기록 삭제 (삭제한 행 수)
  @Modifying
  @Query("delete from ServerMetricSample s where s.sampledAt < :before")
  int deleteOlderThan(@Param("before") Instant before);
}
