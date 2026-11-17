import { apiFetch } from "./client";

// 프로젝트별 알림 받기: 모든 게시글 수정 / 나를 @언급한 페이지만 / 받지 않음
export type NotificationLevel = "ALL" | "MENTION" | "OFF";

export interface NotificationSettingDto {
  spaceId: number;
  level: NotificationLevel;
}

// 살아 있는 프로젝트(최상위 페이지 포함) 전체, 저장하지 않은 프로젝트는 ALL
export function listNotificationSettings(): Promise<NotificationSettingDto[]> {
  return apiFetch<NotificationSettingDto[]>("/api/me/notification-settings");
}

export function changeNotificationSetting(spaceId: number, level: NotificationLevel): Promise<NotificationSettingDto> {
  return apiFetch<NotificationSettingDto>(`/api/me/notification-settings/${spaceId}`, {
    method: "PUT",
    body: JSON.stringify({ level }),
  });
}
