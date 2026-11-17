package dev.jkchappy.portal.notification.dto;

import dev.jkchappy.portal.notification.NotificationLevel;

// 프로젝트(최상위 페이지 포함) 하나의 알림 받기 수준
public record NotificationSettingResponse(Long spaceId, NotificationLevel level) {
}
