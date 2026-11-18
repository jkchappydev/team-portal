import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SpaceDto } from "../api/spaces";
import { ProjectGallery } from "./ProjectGallery";

const spaces = vi.hoisted(() => ({ listSpaces: vi.fn() }));
vi.mock("../api/spaces", () => spaces);

const project = (id: number, over: Partial<SpaceDto> = {}): SpaceDto => ({
  id, name: `프로젝트 ${id}`, description: null, documentCount: 0, homeDocumentId: id * 10, kind: "PROJECT", section: "INTERNAL", icon: "📘",
  cover: null, ...over,
});

function renderGallery() {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/main"]}>
          <Routes>
            <Route path="/main" element={<ProjectGallery />} />
            <Route path="/spaces/:spaceId" element={<div>프로젝트 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("ProjectGallery", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("사이드바 순서대로 상위 10개만 보이고 새 프로젝트 카드는 없다", async () => {
    spaces.listSpaces.mockResolvedValue(Array.from({ length: 12 }, (_, i) => project(i + 1)));
    renderGallery();

    expect(await screen.findByText("프로젝트 1")).toBeTruthy();
    expect(screen.getByText("프로젝트 10")).toBeTruthy();
    expect(screen.queryByText("프로젝트 11")).toBeNull();
    expect(screen.queryByText(/새 프로젝트/)).toBeNull();
  });

  it("커버와 상관없이 사이드바와 같은 프로젝트 아이콘을 크게 보이고, 누르면 프로젝트 화면으로 간다", async () => {
    spaces.listSpaces.mockResolvedValue([project(3, { icon: "🏫", cover: "att:9" })]);
    renderGallery();

    expect(await screen.findByText("🏫")).toBeTruthy();
    expect(document.querySelector(".project-card-preview img")).toBeNull();
    fireEvent.click(screen.getByText("프로젝트 3"));
    expect(await screen.findByText("프로젝트 화면")).toBeTruthy();
  });

  it("아이콘이 없으면 폴더 그림, 아이콘 그림을 불러오지 못해도 폴더 그림", async () => {
    spaces.listSpaces.mockResolvedValue([project(4, { icon: null }), project(5, { icon: "https://x.com/broken.png" })]);
    renderGallery();

    await screen.findByText("프로젝트 4");
    const images = document.querySelectorAll(".project-card-preview img");
    expect(images[0].getAttribute("src")).toBe("/folder.png");
    expect(images[1].getAttribute("src")).toBe("https://x.com/broken.png");
    fireEvent.error(images[1]);
    expect(document.querySelectorAll(".project-card-preview img")[1].getAttribute("src")).toBe("/folder.png");
  });

  it("최상위 페이지는 빼고 프로젝트만 보이며 10개도 프로젝트만 센다", async () => {
    spaces.listSpaces.mockResolvedValue([
      project(1, { kind: "PAGE", name: "메모 페이지" }),
      ...Array.from({ length: 10 }, (_, i) => project(i + 2)),
    ]);
    renderGallery();

    expect(await screen.findByText("프로젝트 2")).toBeTruthy();
    expect(screen.getByText("프로젝트 11")).toBeTruthy();
    expect(screen.queryByText("메모 페이지")).toBeNull();
  });

  it("프로젝트가 없으면 영역을 그리지 않는다", async () => {
    spaces.listSpaces.mockResolvedValue([]);
    renderGallery();
    await Promise.resolve();
    expect(screen.queryByRole("region", { name: "내부 프로젝트" })).toBeNull();
    expect(screen.queryByRole("region", { name: "외부 프로젝트" })).toBeNull();
  });

  it("사이드바처럼 내부·외부 프로젝트 칸을 나눠 보이고, 비어 있는 칸은 그리지 않는다", async () => {
    spaces.listSpaces.mockResolvedValue([
      project(1, { name: "가 프로젝트" }),
      project(2, { name: "나 프로젝트", section: "EXTERNAL" }),
      project(3, { name: "다 프로젝트" }),
    ]);
    renderGallery();

    const internal = await screen.findByRole("region", { name: "내부 프로젝트" });
    const external = screen.getByRole("region", { name: "외부 프로젝트" });
    expect(Array.from(internal.querySelectorAll(".project-card-name")).map((card) => card.textContent)).toEqual(["가 프로젝트", "다 프로젝트"]);
    expect(Array.from(external.querySelectorAll(".project-card-name")).map((card) => card.textContent)).toEqual(["나 프로젝트"]);

    cleanup();
    spaces.listSpaces.mockResolvedValue([project(1, { name: "가 프로젝트" })]);
    renderGallery();
    expect(await screen.findByRole("region", { name: "내부 프로젝트" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "외부 프로젝트" })).toBeNull();
  });
});
