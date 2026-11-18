import { useEffect, useRef, useState } from "react";
import { CloseButton, Paper, Portal, Stack, Text, UnstyledButton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { listNewCs, type NewCsDto } from "../api/cs";
import { pickNewRequests } from "./newCsWatch";

// 신규 CS를 다시 확인하는 간격 (메인 화면 신규 CS 목록과 같은 조회를 함께 씀)
export const NEW_CS_POLL_MS = 30_000;
// 토스트가 떠 있는 시간
export const NEW_CS_TOAST_MS = 6_000;

// 어느 화면에서든 새로 접수된 CS가 생기면 오른쪽 아래에 토스트로 알림 (종 알림과 별개, 누르면 CS 상세를 새 탭으로)
export function NewCsToasts() {
  const { data } = useQuery({ queryKey: ["cs", "new"], queryFn: listNewCs, refetchInterval: NEW_CS_POLL_MS });
  const seen = useRef<Set<number> | null>(null);
  const [toasts, setToasts] = useState<NewCsDto[]>([]);
  // 자동으로 닫는 타이머 (다음 조회 결과가 바로 와도 앞선 토스트가 남지 않게 따로 모아 두고 화면을 떠날 때만 정리)
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    if (!data?.configured) return;
    const { seen: next, fresh } = pickNewRequests(seen.current, data.items);
    seen.current = next;
    if (fresh.length === 0) return;
    setToasts((current) => [...fresh, ...current]);
    // 이번에 뜬 토스트만 정해진 시간 뒤 닫음
    const ids = new Set(fresh.map((cs) => cs.id));
    timers.current.push(window.setTimeout(() => setToasts((current) => current.filter((cs) => !ids.has(cs.id))), NEW_CS_TOAST_MS));
  }, [data]);

  const dismiss = (id: number) => setToasts((current) => current.filter((cs) => cs.id !== id));

  if (toasts.length === 0) return null;
  return (
    <Portal>
      <Stack gap={8} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000, width: "min(340px, calc(100vw - 32px))" }}>
        {toasts.map((cs) => <NewCsToast key={cs.id} cs={cs} onClose={() => dismiss(cs.id)} />)}
      </Stack>
    </Portal>
  );
}

function NewCsToast({ cs, onClose }: { cs: NewCsDto; onClose: () => void }) {
  return (
    <Paper role="status" radius="md" shadow="sm" px="sm" py={8}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        background: "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))",
        border: "1px solid var(--mantine-color-default-border)",
      }}>
      <UnstyledButton component="a" href={cs.detailUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}
        style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
        <Text size="xs" c="dimmed">새 CS · {cs.requesterName || "알 수 없음"}</Text>
        <Text size="sm" truncate>{cs.title}</Text>
      </UnstyledButton>
      <CloseButton size="sm" aria-label="알림 닫기" onClick={onClose} />
    </Paper>
  );
}
