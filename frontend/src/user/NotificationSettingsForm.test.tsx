import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import type { NotificationLevel } from "../api/notificationSettings";

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

function renderForm(draft: Record<number, NotificationLevel> = {}, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <NotificationSettingsForm draft={draft} onChange={onChange} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return onChange;
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

  it("저장 전에 고른 값이 있으면 저장된 값 대신 보여 준다", async () => {
    api.listNotificationSettings.mockResolvedValue([{ spaceId: 2, level: "MENTION" }]);
    renderForm({ 2: "OFF" });

    expect(await screen.findByText(/회의 메모/)).toBeTruthy();
    expect(radio("회의 메모 끄기").checked).toBe(true);
  });

  it("고르면 저장하지 않고 고른 값만 알려 준다", async () => {
    api.listNotificationSettings.mockResolvedValue([]);
    const onChange = renderForm();

    fireEvent.click(await screen.findByLabelText("스쿨북스 끄기"));

    expect(onChange).toHaveBeenCalledWith(1, "OFF");
    expect(api.changeNotificationSetting).not.toHaveBeenCalled();
  });
});
