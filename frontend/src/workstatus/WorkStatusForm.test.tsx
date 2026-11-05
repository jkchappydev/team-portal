import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
});
