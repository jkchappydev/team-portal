import { useState } from "react";
import { ActionIcon, Button, Group, Indicator, Popover, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listDocumentUpdates, listWorkStatusNotices, markAllDocumentUpdatesRead } from "../api/notifications";
import { WorkStatusNotices } from "./WorkStatusNotices";
import { listSpaces } from "../api/spaces";
import { PageIcon } from "../documents/PageIconView";
import { formatRelative, isProjectHome, updatePath } from "./updateFormat";
import { DOCUMENT_UPDATES_KEY, WORK_STATUS_NOTICES_KEY } from "./useMarkDocumentRead";
import { countPendingSignups } from "../api/admin";
import { useCurrentUser } from "../user/currentUser";

// 다른 팀원의 수정을 주기적으로 다시 조회하는 간격
const POLL_MS = 30_000;

// 노션처럼 얇은 선으로 그린 종 아이콘 (글자색을 따라감)
// ring: 새 알림이 왔을 때 한 번 흔들리는 효과
function BellIcon({ ring, onRingEnd }: { ring: boolean; onRingEnd: () => void }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      className="bell-icon" data-ring={ring || undefined} onAnimationEnd={onRingEnd}
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6.5a4 4 0 0 1 8 0c0 3 1.25 4.25 1.25 4.25H2.75S4 9.5 4 6.5z" />
      <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}

export function DocumentUpdatesBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const { user } = useCurrentUser();
  const { data: pending = 0, isSuccess: pendingLoaded } = useQuery({ queryKey: ["admin", "signup-count"], queryFn: countPendingSignups,
    enabled: !!user?.admin, refetchInterval: POLL_MS });
  const { data: updates = [], isSuccess } = useQuery({
    queryKey: DOCUMENT_UPDATES_KEY,
    queryFn: listDocumentUpdates,
    refetchInterval: POLL_MS,
  });
  // 근무 상황 변경 알림 (팀장 이상·개발자만 enabled)
  const { data: workStatus, isFetched: workStatusLoaded } = useQuery({
    queryKey: WORK_STATUS_NOTICES_KEY,
    queryFn: listWorkStatusNotices,
    refetchInterval: POLL_MS,
  });
  const workStatusItems = workStatus?.enabled ? workStatus.items : [];
  // 처음 불러온 뒤 알림 수가 늘어나면 종을 한 번 흔듦 (화면을 처음 열 때는 흔들지 않음)
  const count = updates.length + pending + workStatusItems.length;
  const loaded = isSuccess && workStatusLoaded && (!user?.admin || pendingLoaded);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [ring, setRing] = useState(false);
  if (loaded && lastCount !== count) {
    setLastCount(count);
    if (lastCount !== null && count > lastCount) setRing(true);
  }
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  const readAll = useMutation({
    mutationFn: markAllDocumentUpdatesRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENT_UPDATES_KEY }),
  });

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={300} shadow="md" withinPortal>
      <Popover.Target>
        <Indicator label={count > 9 ? "9+" : count} disabled={count === 0}
          size={16} offset={4} color="red">
          <ActionIcon variant="subtle" color="gray" aria-label="수정 알림" onClick={() => setOpened((v) => !v)}>
            <BellIcon ring={ring} onRingEnd={() => setRing(false)} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        {pending > 0 && <UnstyledButton px="sm" py="xs" onClick={() => { setOpened(false); navigate("/members"); }}>
          가입 요청 {pending}건
        </UnstyledButton>}
        {workStatus?.enabled && <WorkStatusNotices items={workStatusItems} onNavigate={() => setOpened(false)} />}
        {/* 근무 상황 변경 칸이 위에 있으면 위쪽에도 구분선 */}
        <Group justify="space-between" px="sm" py={8}
          style={{ borderBottom: "1px solid var(--mantine-color-default-border)",
            borderTop: workStatus?.enabled ? "1px solid var(--mantine-color-default-border)" : undefined }}>
          <Text size="sm" fw={600}>수정된 페이지</Text>
          <Button size="compact-xs" variant="subtle" disabled={updates.length === 0}
            loading={readAll.isPending} onClick={() => readAll.mutate()}>
            모두 읽음
          </Button>
        </Group>
        {updates.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">새로 수정된 페이지가 없습니다.</Text>
        ) : (
          <ScrollArea.Autosize mah={360}>
            <Stack gap={0} p={4}>
              {updates.map((doc) => (
                <UnstyledButton
                  key={doc.id}
                  className="update-item"
                  px="xs"
                  py={6}
                  onClick={() => {
                    setOpened(false);
                    navigate(updatePath(doc, spaces));
                  }}
                >
                  <Text size="sm" truncate><PageIcon icon={doc.icon} project={isProjectHome(doc, spaces)} /> {doc.title}</Text>
                  <Text size="xs" c="dimmed" truncate>
                    {doc.spaceName} · {doc.updatedByName || "알 수 없음"} · {formatRelative(doc.updatedAt)}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
