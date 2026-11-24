import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerHistory, getServerStatuses, getServiceStatus } from "../api/monitor";
import { splitServerName } from "../home/ServerMonitor";
import { MonitoringPage } from "./MonitoringPage";

vi.mock("../api/monitor", () => ({ getServerStatuses: vi.fn(), getServiceStatus: vi.fn(), getServerHistory: vi.fn() }));

describe("MonitoringPage", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.mocked(getServerHistory).mockResolvedValue({ serverName: "포털 서버", range: "1h",
      from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date().toISOString(), bucketSeconds: 60, points: [] });
    vi.mocked(getServerStatuses).mockResolvedValue([{ available: true, serverName: "포털 서버", osName: "Rocky Linux 8.10",
      kernel: null, cpuPercent: 10, cpuCores: 4, memoryUsedBytes: 1, memoryTotalBytes: 2, uptimeSeconds: 100,
      disks: [], networkRxBytesPerSec: null, networkTxBytesPerSec: null, checkedAt: new Date().toISOString() }]);
  });
  afterEach(cleanup);

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter><MonitoringPage /></MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("서버 기본 정보와 애플리케이션 상태를 정상·장애로 보여주고 DB 영역은 없다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({
      checkedAt: new Date().toISOString(),
      portalDatabase: { up: true, version: "PostgreSQL 17.6", responseMs: 3, connections: 5, sizeBytes: 48 * 1024 ** 3, message: null },
      apps: [
        { server: null, name: "팀 포털", target: "https://team.example.com", kind: "HTTP", up: true, statusCode: 200, responseMs: 85, message: null },
        { server: null, name: "API", target: "host.docker.internal:7001", kind: "TCP", up: false, statusCode: null, responseMs: null, message: "연결 안 됨" },
      ],
      databases: [
        { server: null, name: "MySQL", target: "host.docker.internal:3306", kind: "TCP", up: true, statusCode: null, responseMs: 1, message: null },
      ],
    });
    renderPage();

    expect(await within(screen.getByRole("region", { name: "기본 정보" })).findByText("포털 서버")).toBeTruthy();
    const apps = await screen.findByRole("region", { name: "애플리케이션" });
    expect(within(apps).getByText("팀 포털")).toBeTruthy();
    expect(within(apps).getByText("HTTP 200 · 85ms")).toBeTruthy();
    expect(within(apps).getByText("연결 안 됨")).toBeTruthy();
    expect(within(apps).getByText("장애")).toBeTruthy();
    expect(within(apps).getByText("정상")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "DB" })).toBeNull();
    expect(screen.queryByText("포털 DB")).toBeNull();
  });

  it("아직 확인 전이면 확인 중이라고 안내하고, 대상이 없으면 설정 안내를 보여준다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: null, portalDatabase: null, apps: [], databases: [] });
    renderPage();
    expect(await screen.findByText("확인 중입니다. 잠시 뒤 다시 보입니다.")).toBeTruthy();

    cleanup();
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: new Date().toISOString(), portalDatabase: null, apps: [], databases: [] });
    renderPage();
    expect(await screen.findByText("이 서버에 확인할 애플리케이션이 설정되지 않았습니다.")).toBeTruthy();
  });

  it("고른 서버의 애플리케이션만 보여준다", async () => {
    const base = { osName: null, kernel: null, cpuPercent: 1, cpuCores: 4, memoryUsedBytes: null, memoryTotalBytes: null,
      uptimeSeconds: null, disks: [], networkRxBytesPerSec: null, networkTxBytesPerSec: null, checkedAt: new Date().toISOString() };
    vi.mocked(getServerStatuses).mockResolvedValue([
      { ...base, available: true, serverName: "10.0.0.1 (개발서버)" },
      { ...base, available: true, serverName: "10.0.0.2 (스쿨북스)" },
    ]);
    const check = { kind: "HTTP" as const, up: true, statusCode: 200, responseMs: 5, message: null };
    vi.mocked(getServiceStatus).mockResolvedValue({
      checkedAt: new Date().toISOString(),
      portalDatabase: { up: true, version: "PostgreSQL 17.6", responseMs: 3, connections: 5, sizeBytes: 1, message: null },
      apps: [
        { ...check, server: null, name: "팀 포털", target: "https://team.example.com" },
        { ...check, server: "10.0.0.2", name: "스쿨북스", target: "https://school.example.com" },
      ],
      databases: [],
    });
    renderPage();

    const apps = await screen.findByRole("region", { name: "애플리케이션" });
    expect(within(apps).getByText("팀 포털")).toBeTruthy();
    expect(within(apps).queryByText("스쿨북스")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: "10.0.0.2 (스쿨북스) Online" }));
    expect(within(apps).getByText("스쿨북스")).toBeTruthy();
    expect(within(apps).queryByText("팀 포털")).toBeNull();
  });

  it("고른 서버의 사용 기록 그래프 네 개와 지금 네트워크 전송량을 보여주고 기간을 바꿔 다시 읽는다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: null, portalDatabase: null, apps: [], databases: [] });
    vi.mocked(getServerStatuses).mockResolvedValue([{ available: true, serverName: "포털 서버", osName: null, kernel: null,
      cpuPercent: 10, cpuCores: 4, memoryUsedBytes: 1, memoryTotalBytes: 2, uptimeSeconds: 100, disks: [],
      networkRxBytesPerSec: 2334.72, networkTxBytesPerSec: null, checkedAt: new Date().toISOString() }]);
    renderPage();

    const history = await screen.findByRole("region", { name: "사용 기록" });
    for (const title of ["CPU 사용률", "메모리 사용률", "네트워크 수신", "네트워크 송신"]) {
      expect(await within(history).findByText(title)).toBeTruthy();
    }
    // 기록이 아직 없으면 그래프마다 안내
    expect(within(history).getAllByText("아직 쌓인 기록이 없습니다.")).toHaveLength(4);
    expect(getServerHistory).toHaveBeenCalledWith("포털 서버", "1h");

    const network = screen.getByRole("region", { name: "네트워크 상태" });
    expect(within(network).getByText("2.28 KB/s")).toBeTruthy();
    expect(within(network).getByText("측정 중")).toBeTruthy();

    fireEvent.click(within(history).getByText("7일"));
    await vi.waitFor(() => expect(getServerHistory).toHaveBeenCalledWith("포털 서버", "7d"));
    expect(localStorage.getItem("monitor-history-range")).toBe("7d");
  });

  it("마지막 확인 대신 다음 새로고침까지 남은 초를 보여준다", async () => {
    // 10초 전에 확인 -> 다음 확인 결과는 32초 뒤라 22초 남음
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: new Date(Date.now() - 10_000).toISOString(),
      portalDatabase: null, apps: [], databases: [] });
    renderPage();

    expect(await screen.findByText(/^2[12]초 후 새로고침$/)).toBeTruthy();
    expect(screen.queryByText(/마지막 확인/)).toBeNull();
  });

  it("서버를 읽으면 Online, 못 읽으면 Offline 표시와 서버 버튼 상태를 보여준다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: null, portalDatabase: null, apps: [], databases: [] });
    const base = { osName: null, kernel: null, cpuPercent: 1, cpuCores: 4, memoryUsedBytes: null, memoryTotalBytes: null,
      uptimeSeconds: 3_600, disks: [], networkRxBytesPerSec: null, networkTxBytesPerSec: null, checkedAt: new Date().toISOString() };
    vi.mocked(getServerStatuses).mockResolvedValue([
      { ...base, available: true, serverName: "10.0.0.1 (개발서버)" },
      { ...base, available: false, serverName: "10.0.0.2 (스쿨북스)" },
    ]);
    renderPage();

    const overview = screen.getByRole("region", { name: "기본 정보" });
    expect(await within(overview).findByText("Online")).toBeTruthy();
    expect(within(overview).getByRole("button", { name: "10.0.0.2 (스쿨북스) Offline" })).toBeTruthy();

    fireEvent.click(within(overview).getByRole("button", { name: "10.0.0.2 (스쿨북스) Offline" }));
    expect(await within(overview).findByText("Offline")).toBeTruthy();
    expect(within(overview).getByText("서버 정보를 읽을 수 없습니다.")).toBeTruthy();
  });

  it("서버 고르기 칸은 \"IP (이름)\"을 이름과 IP 두 줄로 나눠 보여준다", () => {
    expect(splitServerName("211.252.85.222 (더북리스트, EDC)")).toEqual({ title: "더북리스트, EDC", address: "211.252.85.222" });
    expect(splitServerName("포털 서버")).toEqual({ title: "포털 서버", address: null });
  });
});
