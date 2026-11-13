import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { COLOR_SCHEME_STORAGE_KEY } from "../theme";

// 선택 칸을 열고 항목을 고름
function choose(label: string) {
  fireEvent.click(screen.getByLabelText("화면 테마", { selector: "input" }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

function renderToggle() {
  return render(
    <MantineProvider
      defaultColorScheme="auto"
      colorSchemeManager={localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })}
    >
      <ColorSchemeToggle />
    </MantineProvider>,
  );
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

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("다크를 고르면 화면 테마가 다크로 바뀌고 선택이 저장된다", () => {
    renderToggle();
    choose("다크");
    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
  });

  it("지금 테마가 선택 칸에 보인다", () => {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "dark");
    renderToggle();
    expect((screen.getByLabelText("화면 테마", { selector: "input" }) as HTMLInputElement).value).toBe("다크");
  });

  it("라이트를 고르면 화면 테마가 라이트로 바뀐다", () => {
    renderToggle();
    choose("다크");
    choose("라이트");
    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("light");
  });
});
