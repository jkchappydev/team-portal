import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MonthPicker } from "./MonthPicker";

function renderPicker(onSelect: (year: number, month: number) => void) {
  render(
    <MantineProvider>
      <MonthPicker year={2026} month={11} onSelect={onSelect}>2026년 11월</MonthPicker>
    </MantineProvider>,
  );
}

describe("MonthPicker", () => {
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
  });

  afterEach(cleanup);

  it("제목을 누르고 달을 고르면 그 연월로 이동한다", async () => {
    const onSelect = vi.fn();
    renderPicker(onSelect);
    fireEvent.click(screen.getByLabelText("연월 선택"));
    fireEvent.click(await screen.findByRole("button", { name: "3월" }));
    expect(onSelect).toHaveBeenCalledWith(2026, 3);
  });

  it("연도를 넘겨서 다른 해의 달로 이동한다", async () => {
    const onSelect = vi.fn();
    renderPicker(onSelect);
    fireEvent.click(screen.getByLabelText("연월 선택"));
    fireEvent.click(await screen.findByLabelText("이전 해"));
    expect(screen.getByText("2025년")).toBeTruthy();
    fireEvent.click((await screen.findByText("12월")).closest("button")!);
    expect(onSelect).toHaveBeenCalledWith(2025, 12);
  });

  it("보고 있는 달을 선택된 상태로 표시한다", async () => {
    renderPicker(vi.fn());
    fireEvent.click(screen.getByLabelText("연월 선택"));
    expect((await screen.findByText("11월")).closest("button")!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("10월").closest("button")!.getAttribute("aria-pressed")).toBe("false");
  });
});
