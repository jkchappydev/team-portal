import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createWorkStatus } from "../api/workStatuses";
import { WorkStatusForm } from "./WorkStatusForm";

vi.mock("../api/members", () => ({
  listMembers: () => Promise.resolve([{ id: 1, name: "홍길동", active: true }]),
}));

vi.mock("../api/workStatuses", () => ({
  createWorkStatus: vi.fn(),
  deleteWorkStatus: vi.fn(),
  updateWorkStatus: vi.fn(),
}));

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <WorkStatusForm
          opened
          onClose={() => {}}
          editing={null}
          defaultDate="2026-11-04"
          currentUserId={1}
        />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("WorkStatusForm", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    // Mantine 선택 목록이 고른 항목으로 스크롤할 때 쓰는 함수 (jsdom에 없음)
    Element.prototype.scrollIntoView ??= () => {};
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("반반차는 시간 대신 오전과 오후를 선택한다", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "반반차" }));

    expect(screen.getByText("오전/오후")).toBeTruthy();
    expect(screen.queryByText("시작 시간")).toBeNull();
    expect(screen.queryByText("종료 시간")).toBeNull();
  });

  it("공가는 기본이 기간이고, 오전/오후를 고르면 하루짜리로 바뀐다", async () => {
    vi.mocked(createWorkStatus).mockResolvedValue({} as Awaited<ReturnType<typeof createWorkStatus>>);
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "공가" }));
    expect(screen.getByLabelText("종료일")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("구분", { selector: "input" }));
    fireEvent.click(await screen.findByRole("option", { name: "오전" }));
    expect(screen.queryByLabelText("종료일")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "등록" }));
    await waitFor(() => expect(createWorkStatus).toHaveBeenCalled());
    expect(vi.mocked(createWorkStatus).mock.calls[0][0]).toMatchObject({
      type: "OFFICIAL_LEAVE", startDate: "2026-11-04", endDate: "2026-11-04", halfDayPeriod: "AM",
    });
  });
});
