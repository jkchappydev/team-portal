import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorPage, errorTitle } from "./ErrorPage";
import { NotFoundPage } from "./NotFoundPage";

describe("ErrorPage", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("오류 코드와 코드별 제목, 버튼을 보여준다", () => {
    const onAction = vi.fn();
    render(<MantineProvider><ErrorPage code="502" actionLabel="다시 시도" onAction={onAction} /></MantineProvider>);
    expect(screen.getByText("502")).toBeTruthy();
    expect(screen.getByText("서버를 준비하는 중입니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("모르는 코드는 일반 오류 제목을 쓴다", () => {
    expect(errorTitle("418")).toBe("오류가 발생했습니다");
    expect(errorTitle("Network Error")).toBe("서버에 연결하지 못했습니다");
  });

  it("없는 주소는 404를 보여주고 버튼으로 첫 화면에 간다", () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={["/nowhere"]}>
          <Routes>
            <Route path="/main" element={<div>메인 화면</div>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "첫 화면으로" }));
    expect(screen.getByText("메인 화면")).toBeTruthy();
  });
});
