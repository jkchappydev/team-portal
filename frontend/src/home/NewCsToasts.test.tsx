import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NewCsDto } from "../api/cs";
import { NEW_CS_POLL_MS, NEW_CS_TOAST_MS, NewCsToasts } from "./NewCsToasts";

vi.mock("../api/cs", () => ({ listNewCs: vi.fn() }));
const { listNewCs } = await import("../api/cs");

const cs = (id: number, title: string, status = "REQS"): NewCsDto => ({
  id, title, groupName: null, requesterName: "김영희", managerName: null, status, statusName: null,
  createdAt: null, detailUrl: `https://cs.example.com/detail?boardKey=${id}`,
});

function renderToasts() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider><NewCsToasts /></MantineProvider>
    </QueryClientProvider>,
  );
}

// 조회 결과가 화면에 반영될 때까지 타이머와 비동기 처리를 진행
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  // 조회 결과 알림(setTimeout 0)과 다시 그리기를 마저 진행
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
}

describe("NewCsToasts", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.mocked(listNewCs).mockReset();
  });

  it("처음 접속할 때 있던 CS는 알리지 않고, 다음 조회에서 새로 접수된 CS만 토스트로 보여 준 뒤 닫는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.mocked(listNewCs)
      .mockResolvedValueOnce({ configured: true, items: [cs(1, "기존 문의")] })
      .mockResolvedValue({ configured: true, items: [cs(3, "진행 문의", "PROG"), cs(2, "로그인 오류"), cs(1, "기존 문의")] });
    renderToasts();
    await flush();
    expect(screen.queryByRole("status")).toBeNull();

    await flush(NEW_CS_POLL_MS);
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("새 CS · 김영희");
    expect(toast.textContent).toContain("로그인 오류");
    expect(screen.queryByText("진행 문의")).toBeNull();
    expect(toast.querySelector("a")?.getAttribute("href")).toBe("https://cs.example.com/detail?boardKey=2");

    await flush(NEW_CS_TOAST_MS);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("닫기 버튼으로 바로 닫는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.mocked(listNewCs)
      .mockResolvedValueOnce({ configured: true, items: [] })
      .mockResolvedValue({ configured: true, items: [cs(5, "새 문의")] });
    renderToasts();
    await flush();
    await flush(NEW_CS_POLL_MS);
    fireEvent.click(screen.getByLabelText("알림 닫기"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
