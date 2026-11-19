import { Badge, Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { markWorkStatusNoticeRead } from "../api/notifications";
import type { WorkStatusNoticeAction, WorkStatusNoticeDto } from "../api/notifications";
import { formatDateRange } from "../workstatus/calendar";
import { formatRelative } from "./updateFormat";
import { WORK_STATUS_NOTICES_KEY } from "./useMarkDocumentRead";

const ACTION_BADGES: Record<WorkStatusNoticeAction, { label: string; color: string }> = {
  CREATED: { label: "등록", color: "teal" },
  UPDATED: { label: "수정", color: "blue" },
  DELETED: { label: "삭제", color: "red" },
};

// 수정 알림 종 안의 "근무 상황 변경" 칸 (팀장 이상·개발자에게만 보임)
// 누르면 그 알림을 확인 처리하고 해당 달 근무 상황표로 이동
export function WorkStatusNotices({ items, onNavigate }: { items: WorkStatusNoticeDto[]; onNavigate: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: WORK_STATUS_NOTICES_KEY });
  const readOne = useMutation({ mutationFn: markWorkStatusNoticeRead, onSettled: refresh });

  return (
    <>
      <Group px="sm" py={8}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <Text size="sm" fw={600}>근무 상황 변경</Text>
      </Group>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">새 근무 상황 변경이 없습니다.</Text>
      ) : (
        <ScrollArea.Autosize mah={240}>
          <Stack gap={0} p={4}>
            {items.map((notice) => {
              const badge = ACTION_BADGES[notice.action];
              return (
                <UnstyledButton
                  key={notice.id}
                  className="update-item"
                  px="xs"
                  py={6}
                  onClick={() => {
                    readOne.mutate(notice.id);
                    onNavigate();
                    navigate(`/work-status?month=${notice.startDate.slice(0, 7)}`);
                  }}
                >
                  <Group gap={6} wrap="nowrap">
                    <Badge size="xs" variant="light" color={badge.color} style={{ flexShrink: 0 }}>{badge.label}</Badge>
                    <Text size="sm" truncate>{notice.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {formatDateRange(notice.startDate, notice.endDate)} · {notice.actorName || "알 수 없음"} · {formatRelative(notice.createdAt)}
                  </Text>
                </UnstyledButton>
              );
            })}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </>
  );
}
