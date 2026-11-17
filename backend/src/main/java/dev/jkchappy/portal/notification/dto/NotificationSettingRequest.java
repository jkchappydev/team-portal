package dev.jkchappy.portal.notification.dto;

import dev.jkchappy.portal.notification.NotificationLevel;
import jakarta.validation.constraints.NotNull;

public record NotificationSettingRequest(@NotNull NotificationLevel level) {
}
