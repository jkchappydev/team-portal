import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerStatus, getServiceStatus } from "../api/monitor";
import { MonitoringPage } from "./MonitoringPage";

vi.mock("../api/monitor", () => ({ getServerStatus: vi.fn(), getServiceStatus: vi.fn() }));

describe("MonitoringPage", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getServerStatus).mockResolvedValue({ available: true, serverName: "포털 서버", osName: "Rocky Linux 8.10",
      kernel: null, cpuPercent: 10, cpuCores: 4, memoryUsedBytes: 1, memoryTotalBytes: 2, uptimeSeconds: 100,
      disks: [], checkedAt: new Date().toISOString() });
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

  it("서버 기본 정보와 애플리케이션·DB 상태를 정상·장애로 보여준다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({
      checkedAt: new Date().toISOString(),
      portalDatabase: { up: true, version: "PostgreSQL 17.6", responseMs: 3, connections: 5, sizeBytes: 48 * 1024 ** 3, message: null },
      apps: [
        { name: "팀 포털", target: "https://team.example.com", kind: "HTTP", up: true, statusCode: 200, responseMs: 85, message: null },
        { name: "API", target: "host.docker.internal:7001", kind: "TCP", up: false, statusCode: null, responseMs: null, message: "연결 안 됨" },
      ],
      databases: [
        { name: "MySQL", target: "host.docker.internal:3306", kind: "TCP", up: true, statusCode: null, responseMs: 1, message: null },
      ],
    });
    renderPage();

    expect(await within(screen.getByRole("region", { name: "기본 정보" })).findByText("포털 서버")).toBeTruthy();
    const apps = await screen.findByRole("region", { name: "애플리케이션" });
    expect(within(apps).getByText("팀 포털")).toBeTruthy();
    expect(within(apps).getByText("HTTP 200 · 85ms")).toBeTruthy();
    expect(within(apps).getByText("연결 안 됨")).toBeTruthy();
    expect(within(apps).getByText("장애")).toBeTruthy();
    const db = screen.getByRole("region", { name: "DB" });
    expect(within(db).getByText("포털 DB")).toBeTruthy();
    expect(within(db).getByText("PostgreSQL 17.6")).toBeTruthy();
    expect(within(db).getByText("3ms · 연결 5개 · 48.0GB")).toBeTruthy();
    expect(within(db).getByText("포트 연결됨 · 1ms")).toBeTruthy();
    expect(within(db).getAllByText("정상")).toHaveLength(2);
  });

  it("아직 확인 전이면 확인 중이라고 안내하고, 대상이 없으면 설정 안내를 보여준다", async () => {
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: null, portalDatabase: null, apps: [], databases: [] });
    renderPage();
    expect(await screen.findByText("확인 중입니다. 잠시 뒤 다시 보입니다.")).toBeTruthy();

    cleanup();
    vi.mocked(getServiceStatus).mockResolvedValue({ checkedAt: new Date().toISOString(), portalDatabase: null, apps: [], databases: [] });
    renderPage();
    expect(await screen.findByText("확인할 애플리케이션이 설정되지 않았습니다.")).toBeTruthy();
  });
});
