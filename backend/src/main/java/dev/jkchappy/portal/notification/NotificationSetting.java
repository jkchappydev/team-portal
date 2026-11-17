package dev.jkchappy.portal.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 팀원이 프로젝트(최상위 페이지 포함)별로 고른 알림 받기 수준 (행이 없으면 ALL)
@Entity
@Table(name = "notification_setting")
@IdClass(NotificationSettingKey.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationSetting {

  @Id
  @Column(name = "member_id")
  private Long memberId;

  @Id
  @Column(name = "space_id")
  private Long spaceId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private NotificationLevel level;
}
