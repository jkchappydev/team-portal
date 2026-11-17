package dev.jkchappy.portal.notification;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

// notification_setting 복합 키 (팀원 ID + 프로젝트 ID)
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class NotificationSettingKey implements Serializable {

  private Long memberId;
  private Long spaceId;
}
