import { Anchor, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getServerStatus } from "../api/monitor";
import { Panel } from "./Panel";
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

// 포털 서버의 CPU·메모리·디스크 사용률을 계기판으로 한 줄에 (2초마다 갱신해 바늘이 실시간으로 움직임, 화면을 보고 있지 않은 탭은 쉼)
// 메인 화면 칸과 모니터링 상세 화면이 같이 씀
export function ServerOverview() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["monitor", "server"],
    queryFn: getServerStatus,
    refetchInterval: 2_000,
  });

  const gauges: (ServerGaugeProps & { key: string })[] = [];
  if (data?.available) {
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

  return (
    <>
      {isError && <Text size="sm" c="red">서버 정보를 불러오지 못했습니다.</Text>}
      {!isLoading && data && !data.available && <Text size="sm" c="dimmed">서버 정보를 읽을 수 없습니다.</Text>}
      {data?.available && (
        <Stack gap="sm">
          <div>
            <Group justify="space-between" gap="xs">
              <Text size="sm" fw={600}>{data.serverName}</Text>
              {data.uptimeSeconds !== null && <Text size="xs" c="dimmed">가동 {formatUptime(data.uptimeSeconds)}</Text>}
            </Group>
            {/* 운영체제 이름 (커널 버전은 사용자 요청으로 표시하지 않음) */}
            {data.osName && <Text size="xs" c="dimmed" truncate>{data.osName}</Text>}
          </div>
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
