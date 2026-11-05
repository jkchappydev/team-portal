import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Toaster } from "./Toaster";
import { showToast } from "./toastStore";

describe("Toaster", () => {
  // jsdom에 없는 matchMedia (Transition의 동작 줄이기 설정 확인용)
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("알림을 화면 중앙 상단에 보여주고 잠시 뒤 사라진다", () => {
    vi.useFakeTimers();
    render(<MantineProvider><Toaster /></MantineProvider>);
    act(() => showToast("링크를 복사했습니다"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("status").textContent).toBe("링크를 복사했습니다");
    act(() => vi.advanceTimersByTime(2000));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
