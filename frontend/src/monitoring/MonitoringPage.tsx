import type { ReactNode } from "react";
import { Box, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getServiceStatus } from "../api/monitor";
import type { PortalDatabaseDto, ServiceCheckDto } from "../api/monitor";
import { ServerOverview, formatBytes, useServerSelection } from "../home/ServerMonitor";
import { formatRelative } from "../notifications/updateFormat";

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

function portalDatabaseInfo(db: PortalDatabaseDto): string {
  if (!db.up) return db.message ?? "";
  return [
    db.responseMs !== null && `${db.responseMs}ms`,
    db.connections !== null && `연결 ${db.connections}개`,
    db.sizeBytes !== null && formatBytes(db.sizeBytes),
  ].filter(Boolean).join(" · ");
}

// 확인 대상의 서버 표시(이름 전체 또는 IP 등 앞부분)가 고른 서버와 같은지, 서버를 적지 않은 대상은 포털 서버 것
export function belongsTo(check: ServiceCheckDto, serverName: string, isPortalServer: boolean): boolean {
  if (!check.server) return isPortalServer;
  return serverName === check.server || serverName.startsWith(`${check.server} `);
}

// 모니터링 상세: 서버 기본 정보(계기판), 서버에서 도는 애플리케이션과 DB가 정상인지
// 애플리케이션·DB는 백엔드가 30초마다 확인한 결과를 10초마다 다시 읽음
export function MonitoringPage() {
  const { data, isError } = useQuery({ queryKey: ["monitor", "services"], queryFn: getServiceStatus, refetchInterval: 10_000 });
  const pending = data !== undefined && data.checkedAt === null;
  // 기본 정보에서 고른 서버의 애플리케이션·DB만 보여 줌
  const selection = useServerSelection();
  const current = selection.current;
  const mine = (check: ServiceCheckDto) => current !== undefined && belongsTo(check, current.serverName, selection.isPortalServer);
  const apps = data?.apps.filter(mine) ?? [];
  const databases = data?.databases.filter(mine) ?? [];

  return (
    <Stack maw={1000} gap="md">
      <Group justify="space-between" align="baseline">
        <Title order={3}>모니터링</Title>
        {data?.checkedAt && <Text size="xs" c="dimmed">마지막 확인 {formatRelative(data.checkedAt)}</Text>}
      </Group>
      <Section title="기본 정보">
        <ServerOverview selection={selection} />
      </Section>
      {isError && <Text size="sm" c="red">애플리케이션·DB 상태를 불러오지 못했습니다.</Text>}
      {pending && <Text size="sm" c="dimmed">확인 중입니다. 잠시 뒤 다시 보입니다.</Text>}
      {data?.checkedAt && (
        <>
          <Section title="애플리케이션">
            <CheckList checks={apps} empty="이 서버에 확인할 애플리케이션이 설정되지 않았습니다." />
          </Section>
          <Section title="DB">
            <Stack gap={0}>
              {/* 포털 DB는 포털이 도는 서버(목록 맨 앞)에서만 */}
              {selection.isPortalServer && data.portalDatabase && (
                <Row name="포털 DB" sub={data.portalDatabase.version ?? "PostgreSQL"}
                  status={<StatusMark up={data.portalDatabase.up} />} info={portalDatabaseInfo(data.portalDatabase)} />
              )}
              {databases.map((check) => (
                <Row key={`${check.name}-${check.target}`} name={check.name} sub={check.target}
                  status={<StatusMark up={check.up} />} info={checkInfo(check)} />
              ))}
              {databases.length === 0 && !(selection.isPortalServer && data.portalDatabase) && (
                <Text size="sm" c="dimmed">이 서버에 확인할 DB가 설정되지 않았습니다.</Text>
              )}
            </Stack>
          </Section>
        </>
      )}
    </Stack>
  );
}
