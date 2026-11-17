import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NotificationSettingsForm } from "./NotificationSettingsForm";

const api = vi.hoisted(() => ({
  listNotificationSettings: vi.fn(),
  changeNotificationSetting: vi.fn(),
}));
vi.mock("../api/notificationSettings", () => api);
vi.mock("../api/spaces", () => ({
  listSpaces: () => Promise.resolve([
    { id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, kind: "PROJECT", icon: null, cover: null },
    { id: 2, name: "회의 메모", description: null, documentCount: 1, homeDocumentId: 20, kind: "PAGE", icon: null, cover: null },
  ]),
}));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <NotificationSettingsForm />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return client;
}

const radio = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("NotificationSettingsForm", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("프로젝트·페이지마다 저장된 값을 고르고, 저장하지 않은 곳은 모든 게시글", async () => {
    api.listNotificationSettings.mockResolvedValue([{ spaceId: 2, level: "MENTION" }]);
    renderForm();

    expect(await screen.findByText(/스쿨북스/)).toBeTruthy();
    expect(screen.getByText(/회의 메모/)).toBeTruthy();
    expect(radio("스쿨북스 모든 게시글").checked).toBe(true);
    expect(radio("회의 메모 담당 언급").checked).toBe(true);
  });

  it("고르면 바로 저장하고 화면에 반영한다", async () => {
    // 저장 뒤 다시 불러오면 서버에 저장된 값이 옴
    api.listNotificationSettings.mockResolvedValueOnce([]).mockResolvedValue([{ spaceId: 1, level: "OFF" }]);
    api.changeNotificationSetting.mockResolvedValue({ spaceId: 1, level: "OFF" });
    renderForm();

    fireEvent.click(await screen.findByLabelText("스쿨북스 끄기"));

    await waitFor(() => expect(api.changeNotificationSetting).toHaveBeenCalledWith(1, "OFF"));
    await waitFor(() => expect(radio("스쿨북스 끄기").checked).toBe(true));
  });

  it("저장에 실패하면 원래 값으로 돌리고 오류를 보인다", async () => {
    api.listNotificationSettings.mockResolvedValue([]);
    api.changeNotificationSetting.mockRejectedValue(new Error("실패"));
    renderForm();

    fireEvent.click(await screen.findByLabelText("스쿨북스 담당 언급"));

    expect(await screen.findByText("알림 설정을 저장하지 못했습니다.")).toBeTruthy();
    await waitFor(() => expect(radio("스쿨북스 모든 게시글").checked).toBe(true));
  });
});
