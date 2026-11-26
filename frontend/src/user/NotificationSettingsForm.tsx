import { Box, Group, Radio, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { listNotificationSettings } from "../api/notificationSettings";
import type { NotificationLevel } from "../api/notificationSettings";
import { listSpaces } from "../api/spaces";
import { PageIcon } from "../documents/PageIconView";
import { NOTIFICATION_SETTINGS_KEY } from "./notificationSettingsKey";

// 표 머리글 순서와 같은 선택지
const NOTIFICATION_LEVELS: { value: NotificationLevel; label: string }[] = [
  { value: "ALL", label: "모든 게시글" },
  { value: "MENTION", label: "담당 언급" },
  { value: "OFF", label: "끄기" },
];

// 선택지 한 칸 너비 (머리글과 줄의 동그라미를 같은 세로선에 맞춤)
const LEVEL_WIDTH = 76;

interface Props {
  // 저장 전에 고른 값 (프로젝트 id → 알림), 없으면 저장된 값
  draft: Record<number, NotificationLevel>;
  onChange: (spaceId: number, level: NotificationLevel) => void;
}

// 설정 창의 알림 탭: 사이드바 순서대로 프로젝트·페이지마다 받을 알림을 고름 (설정 창 저장 버튼으로 저장)
export function NotificationSettingsForm({ draft, onChange }: Props) {
  const { data: spaces = [], isLoading: spacesLoading } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: NOTIFICATION_SETTINGS_KEY,
    queryFn: listNotificationSettings,
  });
  const levelOf = new Map(settings.map((setting) => [setting.spaceId, setting.level]));

  if (spacesLoading || settingsLoading) {
    return <Text size="xs" c="dimmed">알림 설정을 불러오는 중...</Text>;
  }

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        담당 언급은 다른 팀원이 본문에서 @로 나를 언급한 페이지만 알려 줍니다.
      </Text>
      {spaces.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">프로젝트가 없습니다.</Text>
      ) : (
        <Stack gap={0} role="table" aria-label="프로젝트별 알림">
          <Group gap={0} wrap="nowrap" py={6} role="row"
            style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
            <Text size="xs" c="dimmed" style={{ flex: 1 }} role="columnheader">프로젝트</Text>
            {NOTIFICATION_LEVELS.map((level) => (
              <Text key={level.value} size="xs" c="dimmed" ta="center" w={LEVEL_WIDTH} role="columnheader">
                {level.label}
              </Text>
            ))}
          </Group>
          {spaces.map((space) => (
            <Radio.Group
              key={space.id}
              value={draft[space.id] ?? levelOf.get(space.id) ?? "ALL"}
              onChange={(value) => onChange(space.id, value as NotificationLevel)}
              aria-label={`${space.name} 알림`}
            >
              <Group gap={0} wrap="nowrap" py={6} role="row">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" truncate>
                    <PageIcon icon={space.icon} project={space.kind === "PROJECT"} /> {space.name}
                  </Text>
                </Box>
                {NOTIFICATION_LEVELS.map((level) => (
                  <Group key={level.value} justify="center" w={LEVEL_WIDTH}>
                    <Radio value={level.value} size="xs" aria-label={`${space.name} ${level.label}`} />
                  </Group>
                ))}
              </Group>
            </Radio.Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
