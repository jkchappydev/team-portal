import { Anchor, Text, UnstyledButton } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import { Panel } from "./Panel";
import type { ServerStatusDto } from "../api/monitor";
import { gaugeLevel } from "./ServerGauge";
import { formatBytes, splitServerName, useServerSelection } from "./ServerMonitor";

interface Usage {
  percent: number | null;
  // 마우스를 올리면 보이는 설명 (코어 수·용량)
  detail?: string;
}

// 서버 하나의 CPU·메모리·디스크 사용률 (디스크가 여럿이면 가장 많이 쓴 디스크)
export function serverUsages(server: ServerStatusDto): { cpu: Usage; memory: Usage; disk: Usage } {
  const memory = server.memoryUsedBytes !== null && server.memoryTotalBytes !== null && server.memoryTotalBytes > 0
    ? { percent: (server.memoryUsedBytes / server.memoryTotalBytes) * 100, detail: `${formatBytes(server.memoryUsedBytes)} / ${formatBytes(server.memoryTotalBytes)}` }
    : { percent: null };
  const disks = server.disks.filter((d) => d.totalBytes > 0).map((d) => ({ ...d, percent: (d.usedBytes / d.totalBytes) * 100 }));
  const fullest = disks.reduce<(typeof disks)[number] | null>((max, d) => (!max || d.percent > max.percent ? d : max), null);
  const disk = fullest
    ? {
      percent: fullest.percent,
      detail: disks.map((d) => `${disks.length > 1 ? `${d.name} ` : ""}${formatBytes(d.usedBytes)} / ${formatBytes(d.totalBytes)}`).join(", "),
    }
    : { percent: null };
  return { cpu: { percent: server.cpuPercent, detail: server.cpuCores ? `${server.cpuCores}코어` : undefined }, memory, disk };
}

function UsageCell({ label, server, usage }: { label: string; server: string; usage: Usage }) {
  const value = usage.percent === null ? null : Math.round(Math.max(0, Math.min(100, usage.percent)));
  return (
    <span className="server-table-usage" title={usage.detail}>
      <span className="server-gauge-track" role="meter" aria-label={`${server} ${label} 사용률`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
        <span className="server-gauge-bar" data-level={gaugeLevel(usage.percent)} style={{ width: `${value ?? 0}%` }} />
      </span>
      <span className="server-table-value">{value === null ? "-" : `${value}%`}</span>
    </span>
  );
}

// 메인 모니터링 칸: 모든 서버를 한 줄씩 CPU·메모리·디스크 막대로 (고르지 않아도 어느 서버가 찼는지 바로 보임)
// 줄을 누르면 그 서버를 고른 채로 모니터링 상세 화면을 엶 (상세 화면이 같은 선택 기억을 씀)
export function ServerTable() {
  const navigate = useNavigate();
  const { list, select, isError } = useServerSelection();

  return (
    <div className="server-table">
      {isError && <Text size="sm" c="red" mb="xs">서버 정보를 불러오지 못했습니다.</Text>}
      {list.length > 0 && (
        <div className="server-table-row is-head" aria-hidden>
          <span>서버</span><span>CPU</span><span>MEMORY</span><span>DISK</span>
        </div>
      )}
      {list.map((server) => {
        const { title, address } = splitServerName(server.serverName);
        const usages = server.available ? serverUsages(server) : null;
        return (
          <UnstyledButton key={server.serverName} className="server-table-row"
            aria-label={`${server.serverName} ${server.available ? "Online" : "Offline"} 자세히`}
            onClick={() => {
              select(server.serverName);
              navigate("/monitoring");
            }}>
            <span className="server-table-name" title={address ? `${title} (${address})` : undefined}>
              <span className={`server-dot ${server.available ? "is-online" : "is-offline"}`} aria-hidden />
              <span className="server-table-title">{title}</span>
            </span>
            {usages ? (
              <>
                <UsageCell label="CPU" server={title} usage={usages.cpu} />
                <UsageCell label="MEMORY" server={title} usage={usages.memory} />
                <UsageCell label="DISK" server={title} usage={usages.disk} />
              </>
            ) : (
              <span className="server-table-offline">연결 안 됨</span>
            )}
          </UnstyledButton>
        );
      })}
    </div>
  );
}

// 메인 화면 모니터링 칸 (자세히 누르면 애플리케이션·DB 상태가 있는 상세 화면)
export function ServerMonitor() {
  return (
    <Panel title="모니터링" action={<Anchor component={Link} to="/monitoring" size="sm">자세히</Anchor>}>
      <ServerTable />
    </Panel>
  );
}
