import { useState } from "react";
import type { ReactNode } from "react";
import { Group, Paper, SegmentedControl, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getServerHistory } from "../api/monitor";
import type { HistoryPointDto, HistoryRange, ServerStatusDto } from "../api/monitor";
import { MetricChart, formatRate } from "./MetricChart";
import { CpuIcon, DownloadIcon, MemoryIcon, NetworkIcon, UploadIcon } from "./MonitorIcons";
import type { ChartPoint } from "./MetricChart";

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: "1h", label: "1시간" },
  { value: "6h", label: "6시간" },
  { value: "24h", label: "24시간" },
  { value: "7d", label: "7일" },
];

// 마지막으로 고른 기간 (화면을 다시 열어도 유지, 저장소를 못 쓰면 1시간)
const RANGE_KEY = "monitor-history-range";

function readRange(): HistoryRange {
  try {
    const saved = localStorage.getItem(RANGE_KEY);
    return RANGES.some((r) => r.value === saved) ? (saved as HistoryRange) : "1h";
  } catch {
    return "1h";
  }
}

function writeRange(range: HistoryRange): void {
  try {
    localStorage.setItem(RANGE_KEY, range);
  } catch {
    // 저장하지 못해도 이번 화면에서는 고른 기간을 보여 줌
  }
}

const CHARTS: { key: keyof Omit<HistoryPointDto, "at">; title: string; color: string; kind: "percent" | "rate"; icon: ReactNode }[] = [
  { key: "cpuPercent", title: "CPU 사용률", color: "var(--mantine-color-blue-6)", kind: "percent", icon: <CpuIcon /> },
  { key: "memoryPercent", title: "메모리 사용률", color: "var(--mantine-color-teal-6)", kind: "percent", icon: <MemoryIcon /> },
  { key: "rxBytesPerSec", title: "네트워크 수신", color: "var(--mantine-color-violet-6)", kind: "rate", icon: <DownloadIcon /> },
  { key: "txBytesPerSec", title: "네트워크 송신", color: "var(--mantine-color-orange-6)", kind: "rate", icon: <UploadIcon /> },
];

// 고른 서버의 CPU·메모리·네트워크 사용 기록 그래프와 지금 네트워크 전송량
// 기록은 백엔드가 1분마다 쌓고 7일까지 보관, 화면은 1분마다 다시 읽음
export function ServerHistory({ server }: { server: ServerStatusDto }) {
  const [range, setRange] = useState<HistoryRange>(readRange);
  const { data, isError } = useQuery({
    queryKey: ["monitor", "history", server.serverName, range],
    queryFn: () => getServerHistory(server.serverName, range),
    refetchInterval: 60_000,
  });

  const from = data ? Date.parse(data.from) : 0;
  const to = data ? Date.parse(data.to) : 0;

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md" component="section" aria-label="사용 기록">
        <Group justify="space-between" mb="sm" gap="xs">
          <Title order={5}>사용 기록</Title>
          <SegmentedControl size="xs" data={RANGES} value={range} aria-label="기간"
            onChange={(value) => { setRange(value as HistoryRange); writeRange(value as HistoryRange); }} />
        </Group>
        {isError && <Text size="sm" c="red">사용 기록을 불러오지 못했습니다.</Text>}
        {data && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {CHARTS.map((chart) => {
              const points: ChartPoint[] = data.points.map((p) => ({ t: Date.parse(p.at), v: p[chart.key] }));
              return (
                <MetricChart key={chart.key} title={chart.title} icon={chart.icon} color={chart.color} kind={chart.kind}
                  points={points} from={from} to={to} bucketMs={data.bucketSeconds * 1000} />
              );
            })}
          </SimpleGrid>
        )}
      </Paper>
      <Paper withBorder radius="md" p="md" component="section" aria-label="네트워크 상태">
        <Title order={5} mb="sm" className="icon-text"><NetworkIcon size={18} />네트워크 상태</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NetworkRate label="다운로드" icon={<DownloadIcon />} value={server.networkRxBytesPerSec} />
          <NetworkRate label="업로드" icon={<UploadIcon />} value={server.networkTxBytesPerSec} />
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

function NetworkRate({ label, icon, value }: { label: string; icon: ReactNode; value: number | null }) {
  return (
    <Group justify="space-between" className="network-rate" wrap="nowrap">
      <Text size="sm" className="icon-text">{icon}{label}</Text>
      <Text size="sm" fw={600}>{value === null ? "측정 중" : formatRate(value)}</Text>
    </Group>
  );
}
