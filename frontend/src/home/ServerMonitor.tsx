import { useEffect, useState } from "react";
import { Anchor, Group, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getServerStatuses, SERVERS_STREAM_URL } from "../api/monitor";
import type { ServerStatusDto } from "../api/monitor";
import { Panel } from "./Panel";
import { ClockIcon, ServerStatusBadge } from "../monitoring/MonitorIcons";
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

// "IP (이름)" 형식이면 이름과 IP로 나눔 (아니면 전체를 이름으로)
export function splitServerName(serverName: string): { title: string; address: string | null } {
  const match = /^(\S+) \((.+)\)$/.exec(serverName);
  return match ? { title: match[2], address: match[1] } : { title: serverName, address: null };
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

const SERVERS_KEY = ["monitor", "servers"];
// 실시간 연결을 못 쓰게 됐을 때(서버 재시작 등) 2초 조회로 버티다가 다시 연결을 시도하는 간격
export const STREAM_RETRY_MS = 30_000;
const POLL_MS = 2_000;
// EventSource.CLOSED (다시 연결하지 않고 끝난 상태)
const CLOSED = 2;

// 화면이 보이는 동안 서버가 2초마다 보내는 서버 목록을 받아 캐시에 넣음 (탭이 가려지면 연결을 닫음)
// 연결을 쓸 수 있으면 true, 못 쓰면 false (이때는 2초 조회로 대신함)
export function useServerStream(): boolean {
  const queryClient = useQueryClient();
  const supported = typeof EventSource !== "undefined";
  const [live, setLive] = useState(supported);

  useEffect(() => {
    if (!supported) return;
    // 끊긴 뒤 일정 시간이 지나면 다시 연결 시도
    if (!live) {
      const timer = setTimeout(() => setLive(true), STREAM_RETRY_MS);
      return () => clearTimeout(timer);
    }
    let source: EventSource | null = null;
    const onServers = (event: Event) => {
      queryClient.setQueryData(SERVERS_KEY, JSON.parse((event as MessageEvent<string>).data) as ServerStatusDto[]);
    };
    // 네트워크가 잠깐 끊기면 브라우저가 알아서 다시 연결, 오류 응답으로 끝나 버리면 조회로 전환
    const onError = () => {
      if (source?.readyState === CLOSED) {
        close();
        setLive(false);
      }
    };
    const open = () => {
      if (source) return;
      source = new EventSource(SERVERS_STREAM_URL);
      source.addEventListener("servers", onServers);
      source.addEventListener("error", onError);
    };
    const close = () => {
      source?.close();
      source = null;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? close() : open());
    if (document.visibilityState !== "hidden") open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [supported, live, queryClient]);

  return live;
}

// 서버 목록(실시간 연결로 2초마다 받아 바늘이 움직임, 화면을 보고 있지 않은 탭은 쉼)과 고른 서버
// 상세 화면은 계기판과 애플리케이션·DB 목록이 같은 선택을 쓰도록 이 값을 함께 넘김
export function useServerSelection(): ServerSelection {
  const live = useServerStream();
  const { data: servers, isError } = useQuery({
    queryKey: SERVERS_KEY,
    queryFn: getServerStatuses,
    refetchInterval: live ? false : POLL_MS,
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
// 선택을 넘겨받으면 그 연결을 쓰고, 아니면 직접 연결 (한 화면에 실시간 연결이 둘 생기지 않게)
// picker: 서버 고르기 모양 (cards: 이름·IP 두 줄 칸, compact: 한 줄 작은 칸, none: 따로 그리는 화면용)
export type ServerPickerVariant = "cards" | "compact";

export function ServerOverview({ selection, picker = "cards" }: { selection?: ServerSelection; picker?: ServerPickerVariant | "none" }) {
  return selection ? <ServerOverviewView selection={selection} picker={picker} /> : <OwnServerOverview picker={picker} />;
}

function OwnServerOverview({ picker }: { picker: ServerPickerVariant | "none" }) {
  return <ServerOverviewView selection={useServerSelection()} picker={picker} />;
}

function ServerOverviewView({ selection, picker }: { selection: ServerSelection; picker: ServerPickerVariant | "none" }) {
  const { current, isError } = selection;

  return (
    <Stack gap="sm">
      {isError && <Text size="sm" c="red">서버 정보를 불러오지 못했습니다.</Text>}
      {picker !== "none" && <ServerPicker selection={selection} variant={picker} />}
      {current && <ServerDetail data={current} />}
    </Stack>
  );
}

// 서버 고르기 (서버가 하나뿐이면 그리지 않음)
// cards: 같은 폭 칸을 화면 폭에 맞춰 나란히 (좁으면 여러 줄), 칸마다 상태 점·이름·IP
// compact: 한 줄에 상태 점·이름만 (IP는 마우스를 올리면 보임, 칸이 너무 좁아지면 옆으로 넘김)
export function ServerPicker({ selection, variant = "cards" }: { selection: ServerSelection; variant?: ServerPickerVariant }) {
  const { list, current, select } = selection;
  if (list.length <= 1 || !current) return null;
  const compact = variant === "compact";

  return (
    <div className={compact ? "server-picker is-compact" : "server-picker"} role="group" aria-label="서버 선택">
      {list.map((s) => {
        const { title, address } = splitServerName(s.serverName);
        const active = s.serverName === current.serverName;
        return (
          <UnstyledButton
            key={s.serverName}
            className="server-pick"
            data-active={active || undefined}
            title={compact && address ? `${title} (${address})` : undefined}
            aria-label={`${s.serverName} ${s.available ? "Online" : "Offline"}`}
            aria-pressed={active}
            onClick={() => select(s.serverName)}
          >
            <span className={`server-dot ${s.available ? "is-online" : "is-offline"}`} aria-hidden />
            <span className="server-pick-text">
              <span className="server-pick-title">{title}</span>
              {!compact && address && <span className="server-pick-address">{address}</span>}
            </span>
          </UnstyledButton>
        );
      })}
    </div>
  );
}

// 서버 하나의 이름·운영체제·가동 시간과 계기판
function ServerDetail({ data }: { data: ServerStatusDto }) {
  const gauges: (ServerGaugeProps & { key: string })[] = [];
  if (data.available) {
    gauges.push({ key: "cpu", label: "CPU", percent: data.cpuPercent, detail: data.cpuCores ? `${data.cpuCores}코어` : undefined });
    if (data.memoryUsedBytes !== null && data.memoryTotalBytes !== null && data.memoryTotalBytes > 0) {
      gauges.push({
        key: "memory",
        label: "MEMORY",
        percent: (data.memoryUsedBytes / data.memoryTotalBytes) * 100,
        detail: `${formatBytes(data.memoryUsedBytes)} / ${formatBytes(data.memoryTotalBytes)}`,
      });
    }
    // 디스크가 여럿이면 이름에 서버의 마운트 위치를 붙임 (예: DISK (/var))
    for (const disk of data.disks) {
      gauges.push({
        key: `disk-${disk.name}`,
        label: data.disks.length > 1 ? `DISK (${disk.name})` : "DISK",
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
      <ServerOverview picker="compact" />
    </Panel>
  );
}
