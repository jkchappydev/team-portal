import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Box, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getServiceStatus } from "../api/monitor";
import type { ServiceCheckDto } from "../api/monitor";
import { ServerOverview, useServerSelection } from "../home/ServerMonitor";
import { ServerHistory } from "./ServerHistory";

// 정상은 초록, 장애는 빨강 점과 글자
function StatusMark({ up }: { up: boolean }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={8} h={8} style={{ borderRadius: "50%", flexShrink: 0, background: `var(--mantine-color-${up ? "green" : "red"}-6)` }} />
      <Text size="sm" fw={500} c={up ? "green.7" : "red.7"}>{up ? "정상" : "장애"}</Text>
    </Group>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label={title}>
      <Title order={5} mb="sm">{title}</Title>
      {children}
    </Paper>
  );
}

// 한 줄: 왼쪽 이름과 대상, 오른쪽 상태와 응답 정보 (좁은 화면에서는 아래로 내려감)
function Row({ name, sub, status, info }: { name: string; sub: string; status: ReactNode; info: string }) {
  return (
    <Group justify="space-between" gap="xs" py={8} className="monitor-row" wrap="wrap">
      <Box style={{ minWidth: 0, flex: "1 1 200px" }}>
        <Text size="sm" fw={500} truncate>{name}</Text>
        <Text size="xs" c="dimmed" truncate>{sub}</Text>
      </Box>
      <Group gap="md" wrap="nowrap">
        <Text size="xs" c="dimmed">{info}</Text>
        {status}
      </Group>
    </Group>
  );
}

function checkInfo(check: ServiceCheckDto): string {
  if (!check.up) return check.message ?? "";
  const parts = [check.statusCode !== null ? `HTTP ${check.statusCode}` : "포트 연결됨"];
  if (check.responseMs !== null) parts.push(`${check.responseMs}ms`);
  return parts.join(" · ");
}

function CheckList({ checks, empty }: { checks: ServiceCheckDto[]; empty: string }) {
  if (checks.length === 0) return <Text size="sm" c="dimmed">{empty}</Text>;
  return (
    <Stack gap={0}>
      {checks.map((check) => (
        <Row key={`${check.name}-${check.target}`} name={check.name} sub={check.target}
          status={<StatusMark up={check.up} />} info={checkInfo(check)} />
      ))}
    </Stack>
  );
}

// 확인 대상의 서버 표시(이름 전체 또는 IP 등 앞부분)가 고른 서버와 같은지, 서버를 적지 않은 대상은 포털 서버 것
export function belongsTo(check: ServiceCheckDto, serverName: string, isPortalServer: boolean): boolean {
  if (!check.server) return isPortalServer;
  return serverName === check.server || serverName.startsWith(`${check.server} `);
}

// 백엔드는 확인이 끝나고 30초 뒤 다시 확인함 (확인에 걸리는 시간을 감안해 2초 여유)
const CHECK_INTERVAL_MS = 30_000;
const SETTLE_MS = 2_000;

// 다음 확인 결과를 읽어 올 시각
export function nextRefreshAt(checkedAt: string): number {
  return Date.parse(checkedAt) + CHECK_INTERVAL_MS + SETTLE_MS;
}

// 1초마다 바뀌는 현재 시각 (남은 초 표시용)
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// 모니터링 상세: 서버 기본 정보(계기판), 사용 기록 그래프, 서버에서 도는 애플리케이션이 정상인지
// 애플리케이션은 백엔드가 30초마다 확인한 결과를 다음 확인이 끝날 즈음 다시 읽음 (아직 그대로면 2초 뒤 다시)
export function MonitoringPage() {
  const { data, isError } = useQuery({
    queryKey: ["monitor", "services"],
    queryFn: getServiceStatus,
    refetchInterval: (query) => {
      const checkedAt = query.state.data?.checkedAt;
      return checkedAt ? Math.max(2_000, nextRefreshAt(checkedAt) - Date.now()) : 3_000;
    },
  });
  const now = useNow();
  const secondsLeft = data?.checkedAt ? Math.ceil((nextRefreshAt(data.checkedAt) - now) / 1_000) : null;
  const pending = data !== undefined && data.checkedAt === null;
  // 기본 정보에서 고른 서버의 애플리케이션만 보여 줌
  const selection = useServerSelection();
  const current = selection.current;
  const mine = (check: ServiceCheckDto) => current !== undefined && belongsTo(check, current.serverName, selection.isPortalServer);
  const apps = data?.apps.filter(mine) ?? [];

  return (
    <Stack maw={1000} gap="md">
      <Group justify="space-between" align="baseline">
        <Title order={3}>모니터링</Title>
        {secondsLeft !== null && (
          <Text size="xs" c="dimmed" aria-live="off">{secondsLeft > 0 ? `${secondsLeft}초 후 새로고침` : "새로고침 중"}</Text>
        )}
      </Group>
      <Section title="기본 정보">
        <ServerOverview selection={selection} />
      </Section>
      {/* 고른 서버의 CPU·메모리·네트워크 사용 기록 그래프 */}
      {current && <ServerHistory server={current} />}
      {isError && <Text size="sm" c="red">애플리케이션 상태를 불러오지 못했습니다.</Text>}
      {pending && <Text size="sm" c="dimmed">확인 중입니다. 잠시 뒤 다시 보입니다.</Text>}
      {data?.checkedAt && (
        <Section title="애플리케이션">
          <CheckList checks={apps} empty="이 서버에 확인할 애플리케이션이 설정되지 않았습니다." />
        </Section>
      )}
    </Stack>
  );
}
