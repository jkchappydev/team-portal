import { useState } from "react";
import { Anchor, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getServerStatuses } from "../api/monitor";
import type { ServerStatusDto } from "../api/monitor";
import { Panel } from "./Panel";
import { ClockIcon, CpuIcon, DiskIcon, MemoryIcon, ServerStatusBadge } from "../monitoring/MonitorIcons";
import { ServerGauge } from "./ServerGauge";
import type { ServerGaugeProps } from "./ServerGauge";

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 100 ? `${Math.round(gb)}GB` : `${gb.toFixed(1)}GB`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days > 0 ? `${days}일 ${hours}시간` : `${hours}시간 ${Math.floor((seconds % 3_600) / 60)}분`;
}

// 마지막으로 고른 서버 (화면을 다시 열어도 유지, 저장소를 못 쓰면 포털 서버)
const SELECTED_KEY = "monitor-selected-server";

function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function writeSelected(name: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, name);
  } catch {
    // 저장하지 못해도 이번 화면에서는 고른 서버를 보여 줌
  }
}

export interface ServerSelection {
  list: ServerStatusDto[];
  // 고른 서버 (목록이 아직 없으면 undefined, 기억한 서버가 없어졌으면 첫 서버)
  current: ServerStatusDto | undefined;
  // 포털 서버(목록 맨 앞)인지
  isPortalServer: boolean;
  select: (serverName: string) => void;
  isError: boolean;
}

// 서버 목록(2초마다 갱신해 바늘이 실시간으로 움직임, 화면을 보고 있지 않은 탭은 쉼)과 고른 서버
// 상세 화면은 계기판과 애플리케이션·DB 목록이 같은 선택을 쓰도록 이 값을 함께 넘김
export function useServerSelection(): ServerSelection {
  const { data: servers, isError } = useQuery({
    queryKey: ["monitor", "servers"],
    queryFn: getServerStatuses,
    refetchInterval: 2_000,
  });
  const [selected, setSelected] = useState<string | null>(readSelected);
  const list = servers ?? [];
  const current = list.find((s) => s.serverName === selected) ?? list[0];
  return {
    list,
    current,
    isPortalServer: current !== undefined && current === list[0],
    select: (name) => { setSelected(name); writeSelected(name); },
    isError,
  };
}

// 운영 서버들의 CPU·메모리·디스크 사용률을 계기판으로 한 줄에
// 서버가 여럿이면 위의 서버 버튼으로 하나씩 봄, 메인 화면 칸과 모니터링 상세 화면이 같이 씀
export function ServerOverview({ selection }: { selection?: ServerSelection }) {
  const own = useServerSelection();
  const { list, current, select, isError } = selection ?? own;

  return (
    <Stack gap="sm">
      {isError && <Text size="sm" c="red">서버 정보를 불러오지 못했습니다.</Text>}
      {list.length > 1 && current && (
        // 서버 이름이 길어 좁은 화면에서는 다음 줄로 넘어가는 버튼 묶음
        <Group gap={6} role="group" aria-label="서버 선택">
          {list.map((s) => (
            <Button
              key={s.serverName}
              size="compact-xs"
              variant={s.serverName === current.serverName ? "filled" : "default"}
              // 서버를 읽을 수 있는지 초록·빨강 점 (점만으로 구분하지 않도록 이름표에도 상태를 붙임)
              leftSection={<span className={`server-dot ${s.available ? "is-online" : "is-offline"}`} aria-hidden />}
              aria-label={`${s.serverName} ${s.available ? "Online" : "Offline"}`}
              aria-pressed={s.serverName === current.serverName}
              onClick={() => select(s.serverName)}
            >
              {s.serverName}
            </Button>
          ))}
        </Group>
      )}
      {current && <ServerDetail data={current} />}
    </Stack>
  );
}

// 서버 하나의 이름·운영체제·가동 시간과 계기판
function ServerDetail({ data }: { data: ServerStatusDto }) {
  const gauges: (ServerGaugeProps & { key: string })[] = [];
  if (data.available) {
    gauges.push({ key: "cpu", label: "CPU", icon: <CpuIcon size={13} />, percent: data.cpuPercent, detail: data.cpuCores ? `${data.cpuCores}코어` : undefined });
    if (data.memoryUsedBytes !== null && data.memoryTotalBytes !== null && data.memoryTotalBytes > 0) {
      gauges.push({
        key: "memory",
        label: "MEMORY",
        icon: <MemoryIcon size={13} />,
        percent: (data.memoryUsedBytes / data.memoryTotalBytes) * 100,
        detail: `${formatBytes(data.memoryUsedBytes)} / ${formatBytes(data.memoryTotalBytes)}`,
      });
    }
    // 디스크가 여럿이면 이름에 서버의 마운트 위치를 붙임 (예: DISK (/var))
    for (const disk of data.disks) {
      gauges.push({
        key: `disk-${disk.name}`,
        label: data.disks.length > 1 ? `DISK (${disk.name})` : "DISK",
        icon: <DiskIcon size={13} />,
        percent: (disk.usedBytes / disk.totalBytes) * 100,
        detail: `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`,
      });
    }
  }

  if (!data.available) {
    return (
      <Stack gap={4}>
        <Group gap={8} wrap="nowrap">
          <Text size="sm" fw={600} style={{ minWidth: 0 }} truncate>{data.serverName}</Text>
          <ServerStatusBadge online={false} />
        </Group>
        <Text size="sm" c="dimmed">서버 정보를 읽을 수 없습니다.</Text>
      </Stack>
    );
  }
  return (
    <>
      {(
        <Stack gap="sm">
          {/* 왼쪽 서버 이름, 오른쪽 위 운영체제 이름(커널 버전은 사용자 요청으로 표시하지 않음)과 그 아래 가동 시간 */}
          <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
            {/* 서버 이름 바로 옆에 상태 알약 (이름이 길면 이름만 줄여 보임) */}
            <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} style={{ minWidth: 0 }} truncate>{data.serverName}</Text>
              <ServerStatusBadge online />
            </Group>
            <Stack gap={0} align="flex-end" style={{ minWidth: 0 }}>
              {data.osName && <Text size="xs" c="dimmed" ta="right" truncate maw="100%">{data.osName}</Text>}
              {data.uptimeSeconds !== null && (
                <Text size="xs" c="dimmed" className="icon-text"><ClockIcon size={12} />가동 {formatUptime(data.uptimeSeconds)}</Text>
              )}
            </Stack>
          </Group>
          <SimpleGrid cols={gauges.length} spacing="xs">
            {gauges.map(({ key, ...gauge }) => <ServerGauge key={key} {...gauge} />)}
          </SimpleGrid>
        </Stack>
      )}
    </>
  );
}

// 메인 화면 모니터링 칸 (자세히 누르면 애플리케이션·DB 상태가 있는 상세 화면)
export function ServerMonitor() {
  return (
    <Panel title="모니터링" action={<Anchor component={Link} to="/monitoring" size="sm">자세히</Anchor>}>
      <ServerOverview />
    </Panel>
  );
}
