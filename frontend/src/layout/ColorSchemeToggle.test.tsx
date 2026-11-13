import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ColorSchemeToggle } from "./ColorSchemeToggle";

// 선택 칸을 열고 항목을 고름
function choose(label: string) {
  fireEvent.click(screen.getByLabelText("화면 테마", { selector: "input" }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("ColorSchemeToggle", () => {
  beforeAll(() => {
    // Mantine이 사용하는 matchMedia를 jsdom에 제공
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
    // Select 목록이 사용하는 ResizeObserver를 jsdom에 제공
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => cleanup());

  it("받은 값을 선택 칸에 보여 준다", () => {
    render(<MantineProvider><ColorSchemeToggle value="dark" onChange={vi.fn()} /></MantineProvider>);
    expect((screen.getByLabelText("화면 테마", { selector: "input" }) as HTMLInputElement).value).toBe("다크");
  });

  it("고르면 고른 값만 알려 주고 화면 테마는 바꾸지 않는다", () => {
    const onChange = vi.fn();
    render(<MantineProvider><ColorSchemeToggle value="light" onChange={onChange} /></MantineProvider>);
    const before = document.documentElement.getAttribute("data-mantine-color-scheme");
    choose("다크");
    expect(onChange).toHaveBeenCalledWith("dark");
    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe(before);
  });
});
