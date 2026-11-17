package dev.jkchappy.portal.notification;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationSettingRepository extends JpaRepository<NotificationSetting, NotificationSettingKey> {

  // 팀원이 저장한 설정 (저장하지 않은 프로젝트는 없음)
  List<NotificationSetting> findByMemberId(Long memberId);

  // 설정 저장 (이미 있으면 덮어씀, 동시 요청에도 한 행만 유지)
  @Modifying
  @Query(value = "insert into notification_setting (member_id, space_id, level) values (:memberId, :spaceId, :level) "
    + "on conflict (member_id, space_id) do update set level = excluded.level", nativeQuery = true)
  void upsert(@Param("memberId") Long memberId, @Param("spaceId") Long spaceId, @Param("level") String level);
}
