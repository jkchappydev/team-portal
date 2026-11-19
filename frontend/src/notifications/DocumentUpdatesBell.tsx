import { useState } from "react";
import { ActionIcon, Group, Indicator, Popover, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listDocumentUpdates, listWorkStatusNotices } from "../api/notifications";
import { WorkStatusNotices } from "./WorkStatusNotices";
import { listSpaces } from "../api/spaces";
import { PageIcon } from "../documents/PageIconView";
import { formatRelative, isProjectHome, updatePath } from "./updateFormat";
import { DOCUMENT_UPDATES_KEY, WORK_STATUS_NOTICES_KEY } from "./useMarkDocumentRead";
import { countPendingSignups } from "../api/admin";
import { useCurrentUser } from "../user/currentUser";

// 다른 팀원의 수정을 주기적으로 다시 조회하는 간격
const POLL_MS = 30_000;

// 종을 열어 본 알림 목록 (브라우저에 사용자별로 기억, 저장소를 못 쓰면 이번 화면에서만)
function seenStorageKey(userId: number | undefined): string {
  return `notification-seen-${userId ?? "anonymous"}`;
}

function readSeen(userId: number | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(seenStorageKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(userId: number | undefined, keys: string[]): void {
  try {
    localStorage.setItem(seenStorageKey(userId), JSON.stringify(keys));
  } catch {
    // 저장소를 못 쓰는 환경이면 이번 화면에서만 유지
  }
}

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
  const [opened, setOpened] = useState(false);
  const { user } = useCurrentUser();
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(user?.id));
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
  // 지금 보이는 알림마다 키 (같은 페이지라도 다시 수정되면 새 알림, 가입 요청은 건수가 늘면 새 알림)
  const keys = [
    ...updates.map((doc) => `doc:${doc.id}:${doc.updatedAt}`),
    ...workStatusItems.map((notice) => `work:${notice.id}`),
    ...(pending > 0 ? [`signup:${pending}`] : []),
  ];
  // 아직 종을 열어 보지 않은 알림이 있으면 빨간 점
  const unseen = keys.some((key) => !seen.has(key));
  const toggle = () => {
    // 종을 열면 지금 알림을 모두 본 것으로 기억 (목록 항목은 페이지를 열어야 읽음 처리되어 빠짐)
    if (!opened) {
      const next = new Set(keys);
      setSeen(next);
      saveSeen(user?.id, keys);
    }
    setOpened((v) => !v);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={300} shadow="md" withinPortal>
      <Popover.Target>
        {/* 숫자 없이 빨간 점만, 종을 열면 사라짐 */}
        <Indicator disabled={!unseen} size={6} offset={4} color="red" data-testid="bell-dot">
          <ActionIcon variant="subtle" color="gray" aria-label="수정 알림" onClick={toggle}>
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
        <Group px="sm" py={8}
          style={{ borderBottom: "1px solid var(--mantine-color-default-border)",
            borderTop: workStatus?.enabled ? "1px solid var(--mantine-color-default-border)" : undefined }}>
          <Text size="sm" fw={600}>최근 수정된 게시글</Text>
        </Group>
        {updates.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">최근 수정된 게시글이 없습니다.</Text>
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
                    {doc.mentioned && <Text span size="xs" c="blue" fw={500}>@나를 언급 · </Text>}
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
